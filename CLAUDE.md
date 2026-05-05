# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

**Specification phase.** Single source of truth: `generative-agents-platform-spec.md`. No source code exists yet. All implementation decisions must trace back to that document.

## What This Is

Self-hosted, low-code platform installed via Terraform into a customer's AWS account. Lets users visually design generative AI agents (drag-and-drop canvas), then generates a deployable ZIP containing Python code, Terraform IaC, and Docker containers — all running entirely in the customer's AWS account.

## Four-Layer Architecture

```
Studio (React/TypeScript SPA)
    ↓ Graph JSON (DAG)
Code Generation Engine (Python/FastAPI)
    ↓ agent-{name}-{ts}.zip
Generated Artifacts (Python + Terraform + Docker)
    ↓ terraform apply
AWS Runtime (AgentCore + Lambda + Bedrock + S3 Vectors + Athena)
```

| Layer | Output | Technology |
|---|---|---|
| Studio | Graph DAG JSON | React, TypeScript, React Flow |
| Code Generation Engine | ZIP bundle | Python, FastAPI, Lambda/ECS |
| Generated Artifacts | Deployable agent | LangGraph, boto3, Terraform |
| AWS Runtime | Live agent | AgentCore, Bedrock, Lambda, DynamoDB |

## Platform Tech Stack

**Frontend (Studio):** React, TypeScript, React Flow (canvas), schema-driven config forms, CloudFront + S3 hosting

**Backend (Engine):** Python, FastAPI, deployed as Lambda or ECS, DynamoDB for project storage, Cognito or SSO for auth

**Platform infra:** API Gateway, DynamoDB, CloudFront + S3, Cognito — all Terraform-managed

**Authentication:** Two options configured at install time — Amazon Cognito (user pools, MFA, JWT validated by API Gateway Cognito authorizer) or corporate SSO (SAML 2.0/OIDC via Cognito Identity Federation or ALB+OIDC). Platform receives a validated JWT via `sub` claim and never stores credentials.

## Generated Artifact Tech Stack

Generated agents use:
- **Framework:** LangGraph + LangChain (ReAct pattern)
- **LLM:** Amazon Bedrock (Claude, Titan) — Bedrock-only for v1
- **MCP:** agentcore-sdk (MCP Server + Client) — PyPI package name unconfirmed, see Open Items
- **HTTP:** FastAPI + uvicorn
- **Dependency manager:** uv
- **Testing:** pytest + moto (AWS mocks) + responses (HTTP mocks)
- **Container:** Docker `python:3.12-slim`
- **Observability:** LangSmith traces + CloudWatch structured JSON logs

## Generated Artifact ZIP Structure

```
agent-{name}-{timestamp}.zip
├── agent/              ← LangGraph package: graph.py, state.py, config.py, runner.py, nodes/{node_id}.py
├── tools/              ← Tool implementations ({tool_name}.py)
├── mcp_server/         ← MCP server for AgentCore Runtime: server.py, tools.py, resources.py
├── infra/              ← Terraform: main.tf, lambda.tf, agentcore.tf, iam.tf, dynamodb.tf, ...
├── tests/              ← pytest files, one per tool node
├── local/              ← Local simulation: run_agent.py, run_workflow.py, mock_tools.py
├── Dockerfile
├── pyproject.toml      ← uv-managed dependencies (requires-python = ">=3.12")
├── .env.example
└── project.json        ← Re-import schema
```

## Commands for Generated Agents

These commands run inside a generated agent's ZIP directory, not the platform itself:

```bash
# Test
uv run pytest tests/ -v

# Local run with mocked AWS
uv run python local/run_agent.py --input '{"message": "..."}' --mock-tools

# Local run with real AWS
AWS_PROFILE=dev uv run python local/run_agent.py --input '{"message": "..."}'

# Docker local
docker build -t my-agent .
docker run --env-file .env my-agent python local/run_agent.py

# Deploy
cd infra/
terraform init -backend-config=backend.hcl
terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars
```

## Code Generation Pipeline (Engine internals)

Seven sequential phases when user clicks "Generate":

1. **Validator** — topological sort, type-check edges, required fields
2. **Graph Compiler** — emits Python: state schema, node functions, LangGraph assembly
3. **IaC Generator** — Terraform modules: IAM roles, Lambda, AgentCore, API Gateway
4. **Test Generator** — pytest files with moto mocks, one file per tool node
5. **Local Runner Scaffold** — Docker + CLI for local testing
6. **Observability Injector** — injects LangSmith + CloudWatch tracing into agent code
7. **ZIP Bundler** — packages all artifacts + `project.json` (re-import schema)

### Graph Compiler output structure (`agent/`)

- `state.py` — `TypedDict` with one field per edge port. Type mapping: `string`→`str`, `json`→`dict`, `document`→`List[dict]`, `vector`→`List[float]`, message-carrying edges→`Annotated[List[BaseMessage], operator.add]`
- `nodes/{node_id}.py` — one async function per node: `async def node_{id}(state: AgentState) -> dict` returning only keys this node writes
- `graph.py` — `StateGraph` assembly; `condition` nodes compile to routing functions returning branch name strings (not state mutations)
- `runner.py` — dual entrypoint: synchronous `lambda_handler` and async `streaming_lambda_handler` (only when `agent.streaming=true`); also a CLI `__main__` block

Compilation errors surface as structured JSON with `node_id`, `field`, `code`, `message` — displayed as inline validation markers in the Studio before generation is attempted.

## Node Types (Canvas)

30+ node types. Key ones:

- **Core:** `input`, `output`, `agent`, `multi_agent_coordinator`, `human_in_the_loop`
- **Tools:** `tool_custom` (Python Lambda), `tool_athena` (SQL), `tool_s3`, `tool_http`, `tool_bedrock`
- **Knowledge:** `kb_s3_vector`, `kb_bedrock`, `chunking`, `embedding`, `retriever`
- **Data ingestion:** `s3_source`, `document_parser`, `ingest_pipeline`
- **Integration:** `mcp_server`, `mcp_client`
- **Flow control:** `condition`, `loop`, `cache`, `logger`

## Critical Implementation Invariants

Non-obvious constraints the compiler and engine must enforce exactly:

**`human_in_the_loop` requires DynamoDB checkpointer.** Compiler detects HITL nodes and injects `DynamoDBSaver` into `graph.compile(checkpointer=...)`. Without it, `interrupt()` cannot persist state and the workflow cannot resume. Graphs without HITL nodes must omit the checkpointer.

**`tool_athena` must use `?` positional placeholders via `ExecutionParameters`.** String-formatted queries are prohibited — SQL injection vector. Compiler rejects any `query_template` that uses f-string-style interpolation.

**`condition` node expressions: `jmespath` or `cel` only.** Generating `eval()`-based Python execution is explicitly prohibited — allows arbitrary code execution from the canvas.

**`loop` node ports are two separate subgraph edges.** `item` (per-iteration) and `results` (post-loop aggregate) use LangGraph's Send API. A downstream node cannot be wired to both simultaneously.

**`inference_profile_arn` takes precedence over `model_id`.** When set on `agent` or `tool_bedrock` nodes, the inference profile ARN must be passed to the Bedrock call instead of `model_id`. Required for cross-region inference.

**Secrets fetched lazily via `lru_cache`, never at module import time.** Generated `config.py` wraps `secretsmanager.get_secret_value()` in `@functools.lru_cache`. Call sites use accessor functions (`langsmith_api_key()`) not module-level constants. This avoids Secrets Manager API calls on every cold start.

**OAuth2 tokens for `tool_http` are cached until near-expiry.** Generated tool fetches a token from `token_url` on first call, caches with `lru_cache` keyed on expiry, refreshes 60 seconds before expiry. Token never stored in state or logs. `secret_ref` must point to a secret containing `{"client_id": "...", "client_secret": "..."}`.

**Each tool node generates exactly one Lambda with its own IAM role.** No shared execution roles across tools or agents.

## project.json Versioning

Generated ZIPs include `project.json` for round-trip import. Schema uses semantic versioning with declarative migrators. Platform must support re-importing the last 2 major versions. Never break the migration chain — add migrators, don't modify existing ones.

Migrators live in `platform/migrations/v{from}_to_v{to}.py` with `MIGRATION_FROM`, `MIGRATION_TO` constants and a `migrate(project: dict[str, Any]) -> dict` function. Applied in chain on import. The Studio surfaces a migration warning before opening the canvas.

## Security Constraints

- IAM roles are per-agent, least-privilege — no wildcard resource ARNs in any generated policy
- All credentials via IAM roles + Secrets Manager — no hardcoded values anywhere
- Bedrock Guardrails are optional but architecture must support them (pass `guardrailConfig` to every Bedrock invocation when configured)
- TLS 1.2+ in transit, SSE-S3/SSE-KMS at rest
- `.env.example` contains placeholder values only — never real secrets

## Key Design Decisions (from spec)

- **Single-tenant only** — no multi-workspace, no RBAC in v1
- **Bedrock-only LLM** in v1 — architecture must be provider-agnostic for future extensibility
- **Customer owns generated code** — no license restrictions on ZIP contents
- **Self-hosted** — zero external SaaS runtime dependencies after install
- **Canvas internal state:** normalized DAG `{ nodes: Node[], edges: Edge[] }`, autosaved to DynamoDB every 10 seconds with optimistic updates
- **Streaming:** when `agent.streaming=true`, Lambda requires response streaming enabled in Terraform (`FunctionResponseTypes = ["STREAMRESPONSE"]`); API Gateway must use WebSocket or HTTP chunked transfer

## Open Items Affecting Implementation

- `agentcore-sdk` PyPI package name and distribution channel unconfirmed — update `pyproject.toml` template before v1 release
- Lambda 15-minute limit for complex `multi_agent_coordinator` graphs — Step Functions scaffold planned but not in v1; no workaround in current design
- ElastiCache cache backend deferred — `cache` node is DynamoDB-only in v1
