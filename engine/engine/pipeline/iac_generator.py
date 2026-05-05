"""Phase 3: IaC Generator — emits Terraform modules for the agent runtime."""
from __future__ import annotations

from .._types import CompiledArtifacts, CompiledFile
from ..models.graph import Node, Project, TOOL_NODE_TYPES


def generate_iac(project: Project, sorted_nodes: list[Node]) -> CompiledArtifacts:
    artifacts = CompiledArtifacts()
    agent_name = project.name.lower().replace(" ", "-")
    tool_nodes = [n for n in project.nodes if n.is_tool()]
    has_hitl = project.has_node_type("human_in_the_loop")
    has_memory = any(
        n.config.get("memory", {}).get("enabled", False)
        for n in project.nodes if n.type == "agent"
    )

    artifacts.add(_gen_main_tf(agent_name))
    artifacts.add(_gen_variables_tf(agent_name))
    artifacts.add(_gen_outputs_tf())
    artifacts.add(_gen_iam_tf(agent_name, tool_nodes))
    artifacts.add(_gen_lambda_tf(agent_name, tool_nodes))
    artifacts.add(_gen_agentcore_tf(agent_name))
    artifacts.add(_gen_api_gateway_tf(agent_name))
    if has_hitl or has_memory:
        artifacts.add(_gen_dynamodb_tf(agent_name, has_hitl, has_memory))
    artifacts.add(_gen_dev_tfvars(agent_name))

    return artifacts


def _gen_main_tf(agent_name: str) -> CompiledFile:
    content = f'''\
terraform {{
  required_version = ">= 1.9"

  backend "s3" {{
    # Configure via: terraform init -backend-config="bucket=<state-bucket>" \\
    #                              -backend-config="key={agent_name}/terraform.tfstate"
    dynamodb_table = "{agent_name}-tf-lock"
    encrypt        = true
  }}

  required_providers {{
    aws = {{
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }}
  }}
}}

provider "aws" {{
  region = var.aws_region
}}
'''
    return CompiledFile(path="infra/main.tf", content=content)


def _gen_variables_tf(agent_name: str) -> CompiledFile:
    content = f'''\
variable "agent_name" {{
  description = "Name of the agent (used as resource prefix)"
  type        = string
  default     = "{agent_name}"
}}

variable "environment" {{
  description = "Deployment environment"
  type        = string
  default     = "dev"
}}

variable "aws_region" {{
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}}

variable "ecr_image_uri" {{
  description = "ECR image URI for the agent container"
  type        = string
}}

variable "lambda_memory_mb" {{
  type    = number
  default = 256
}}

variable "lambda_timeout_seconds" {{
  type    = number
  default = 30
}}

variable "agentcore_model_id" {{
  description = "Bedrock model ID for the agent"
  type        = string
  default     = "anthropic.claude-3-5-sonnet-20241022-v2:0"
}}

variable "agentcore_inference_profile_arn" {{
  description = "Cross-region inference profile ARN (takes precedence over model_id when set)"
  type        = string
  default     = ""
}}

variable "enable_memory" {{
  type    = bool
  default = false
}}

variable "memory_ttl_seconds" {{
  type    = number
  default = 3600
}}

variable "latency_alarm_threshold_ms" {{
  type    = number
  default = 5000
}}

variable "cloudwatch_log_retention_days" {{
  type    = number
  default = 30
}}
'''
    return CompiledFile(path="infra/variables.tf", content=content)


def _gen_outputs_tf() -> CompiledFile:
    content = '''\
output "api_gateway_url" {
  description = "Base URL of the deployed API Gateway"
  value       = aws_apigatewayv2_api.agent.api_endpoint
}

output "agent_function_arn" {
  description = "ARN of the main agent Lambda function"
  value       = aws_lambda_function.agent.arn
}
'''
    return CompiledFile(path="infra/outputs.tf", content=content)


def _gen_iam_tf(agent_name: str, tool_nodes: list[Node]) -> CompiledFile:
    tool_role_blocks = ""
    for n in tool_nodes:
        tool_name = n.config.get("name", n.id).lower().replace(" ", "-")
        tool_role_blocks += f'''
resource "aws_iam_role" "tool_{n.id}" {{
  name = "${{var.agent_name}}-tool-{tool_name}"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}}

resource "aws_iam_role_policy" "tool_{n.id}" {{
  role   = aws_iam_role.tool_{n.id}.id
  policy = data.aws_iam_policy_document.tool_{n.id}_policy.json
}}

data "aws_iam_policy_document" "tool_{n.id}_policy" {{
  # Minimal permissions for {n.type} node — expand per tool requirements
  statement {{
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:*"]
  }}
}}
'''

    content = f'''\
data "aws_iam_policy_document" "lambda_assume" {{
  statement {{
    actions = ["sts:AssumeRole"]
    principals {{
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }}
  }}
}}

resource "aws_iam_role" "agent_execution" {{
  name               = "${{var.agent_name}}-execution"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}}

resource "aws_iam_role_policy" "agent_execution" {{
  role   = aws_iam_role.agent_execution.id
  policy = data.aws_iam_policy_document.agent_policy.json
}}

data "aws_iam_policy_document" "agent_policy" {{
  statement {{
    sid     = "Bedrock"
    actions = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
    # Scoped to configured model — replace * with specific model ARNs before production
    resources = ["arn:aws:bedrock:${{var.aws_region}}::foundation-model/*"]
  }}

  statement {{
    sid       = "SecretsManager"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:${{var.aws_region}}:*:secret:${{var.agent_name}}/*"]
  }}

  statement {{
    sid       = "CloudWatch"
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:*"]
  }}
}}
{tool_role_blocks}'''
    return CompiledFile(path="infra/iam.tf", content=content)


def _gen_lambda_tf(agent_name: str, tool_nodes: list[Node]) -> CompiledFile:
    tool_lambda_blocks = ""
    for n in tool_nodes:
        tool_name = n.config.get("name", n.id).lower().replace(" ", "-")
        mem = n.config.get("memory_mb", 256)
        timeout = n.config.get("timeout_seconds", 30)
        tool_lambda_blocks += f'''
resource "aws_lambda_function" "tool_{n.id}" {{
  function_name = "${{var.agent_name}}-tool-{tool_name}"
  role          = aws_iam_role.tool_{n.id}.arn
  image_uri     = var.ecr_image_uri
  package_type  = "Image"
  memory_size   = {mem}
  timeout       = {timeout}
  environment {{
    variables = {{
      AWS_REGION = var.aws_region
      AGENT_NAME = var.agent_name
    }}
  }}
}}
'''

    content = f'''\
resource "aws_lambda_function" "agent" {{
  function_name = "${{var.agent_name}}"
  role          = aws_iam_role.agent_execution.arn
  image_uri     = var.ecr_image_uri
  package_type  = "Image"
  memory_size   = var.lambda_memory_mb
  timeout       = var.lambda_timeout_seconds

  environment {{
    variables = {{
      AWS_REGION       = var.aws_region
      AGENT_NAME       = var.agent_name
      CHECKPOINTER_TABLE = "${{var.agent_name}}-sessions"
      CACHE_TABLE        = "${{var.agent_name}}-cache"
    }}
  }}
}}

resource "aws_cloudwatch_log_group" "agent" {{
  name              = "/aws/lambda/${{var.agent_name}}"
  retention_in_days = var.cloudwatch_log_retention_days
}}
{tool_lambda_blocks}'''
    return CompiledFile(path="infra/lambda.tf", content=content)


def _gen_agentcore_tf(agent_name: str) -> CompiledFile:
    content = f'''\
# Amazon AgentCore resources
# NOTE: AgentCore Terraform provider support may require aws provider >= 5.x
# and the agent_name feature flag enabled in your AWS account.

# Placeholder — replace with actual aws_agentcore_agent resource when available
# resource "aws_agentcore_agent" "agent" {{
#   agent_name     = var.agent_name
#   foundation_model = coalesce(
#     var.agentcore_inference_profile_arn,
#     var.agentcore_model_id
#   )
#   role_arn       = aws_iam_role.agent_execution.arn
# }}
'''
    return CompiledFile(path="infra/agentcore.tf", content=content)


def _gen_api_gateway_tf(agent_name: str) -> CompiledFile:
    content = f'''\
resource "aws_apigatewayv2_api" "agent" {{
  name          = var.agent_name
  protocol_type = "HTTP"
}}

resource "aws_apigatewayv2_integration" "agent" {{
  api_id                 = aws_apigatewayv2_api.agent.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.agent.invoke_arn
  payload_format_version = "2.0"
}}

resource "aws_apigatewayv2_route" "invoke" {{
  api_id    = aws_apigatewayv2_api.agent.id
  route_key = "POST /invoke"
  target    = "integrations/${{aws_apigatewayv2_integration.agent.id}}"
}}

resource "aws_apigatewayv2_stage" "default" {{
  api_id      = aws_apigatewayv2_api.agent.id
  name        = "$default"
  auto_deploy = true
}}

resource "aws_lambda_permission" "api_gateway" {{
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.agent.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${{aws_apigatewayv2_api.agent.execution_arn}}/*/*"
}}
'''
    return CompiledFile(path="infra/api_gateway.tf", content=content)


def _gen_dynamodb_tf(agent_name: str, has_hitl: bool, has_memory: bool) -> CompiledFile:
    content = f'''\
resource "aws_dynamodb_table" "sessions" {{
  name         = "${{var.agent_name}}-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {{
    name = "pk"
    type = "S"
  }}

  attribute {{
    name = "sk"
    type = "S"
  }}

  ttl {{
    attribute_name = "expires_at"
    enabled        = true
  }}
}}

resource "aws_dynamodb_table" "cache" {{
  name         = "${{var.agent_name}}-cache"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {{
    name = "pk"
    type = "S"
  }}

  ttl {{
    attribute_name = "expires_at"
    enabled        = true
  }}
}}
'''
    return CompiledFile(path="infra/dynamodb.tf", content=content)


def _gen_dev_tfvars(agent_name: str) -> CompiledFile:
    content = f'''\
agent_name                      = "{agent_name}"
environment                     = "dev"
aws_region                      = "us-east-1"
ecr_image_uri                   = "<your-account>.dkr.ecr.us-east-1.amazonaws.com/{agent_name}:latest"
lambda_memory_mb                = 256
lambda_timeout_seconds          = 30
agentcore_model_id              = "anthropic.claude-3-5-sonnet-20241022-v2:0"
agentcore_inference_profile_arn = ""
enable_memory                   = false
memory_ttl_seconds              = 3600
latency_alarm_threshold_ms      = 5000
cloudwatch_log_retention_days   = 30
'''
    return CompiledFile(path="infra/dev.tfvars", content=content)
