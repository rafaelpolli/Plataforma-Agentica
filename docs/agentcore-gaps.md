# AgentCore Implementation Status

**Last updated:** 2026-05-06
**Platform branch:** initial-commit (commit `0f44844`)
**Reference:** [Amazon Bedrock AgentCore docs](https://docs.aws.amazon.com/bedrock/latest/userguide/agentcore.html)

This document was originally a *gap analysis*. After the AgentCore-first
refactor, every gap below is closed. The doc is kept as the implementation
record — it shows where each AgentCore primitive lives in the generated
artifacts and what tests cover it.

---

## Summary

Generated agents now run on **AgentCore Runtime** (container, not Lambda),
use **AgentCore Memory** with real SDK calls, vend OAuth2 tokens via
**AgentCore Identity**, expose tools via **AgentCore Gateway** + MCP, run
sandboxed Python in **Code Interpreter**, and emit traces via **AgentCore
Observability** (no LangSmith).

43/43 engine tests green.

---

## Coverage Table

| Component | Status | Where |
|-----------|--------|------|
| AgentCore Runtime | ✅ | `runner_gen.py` → `BedrockAgentCoreApp`; `iac_generator.py` → `aws_bedrockagentcore_agent_runtime`. No Lambda agent. |
| AgentCore Memory | ✅ | `node_gen._gen_agent` → `MemoryClient.create_event` + `retrieve_memories`; `iac_generator._gen_agentcore_memory_tf` → strategies (semantic/summary/user_preference) |
| AgentCore Gateway | ✅ | `_gen_agentcore_gateway_tf` (when `mcp_server` node present) → `aws_bedrockagentcore_gateway` + `gateway_target` |
| AgentCore Identity | ✅ | `tool_gen._gen_tool_http` (oauth2 path) → `IdentityClient.get_token`; `_gen_agentcore_identity_tf` → `aws_bedrockagentcore_oauth2_credential_provider` |
| AgentCore Code Interpreter | ✅ | `node_gen._gen_code_interpreter` → `CodeInterpreterClient.invoke_async`; node type `code_interpreter` in catalog |
| AgentCore Browser Tool | ✅ | `node_gen._gen_browser_tool` → `BrowserClient.invoke_async`; node type `browser_tool` in catalog |
| AgentCore Observability | ✅ | `observability.py` → `bedrock_agentcore.observability.configure(...)`; replaces all LangSmith refs |
| AgentCore MCP Server | ✅ | `node_gen._gen_mcp_server` → `mcp_server/server.py` w/ `bedrock_agentcore.mcp.MCPServer` and `@server.tool` per tool node |
| S3 Vectors | ✅ | `node_gen._gen_kb_s3_vector` → real `boto3.client("s3vectors").query_vectors` w/ `BedrockEmbeddings` |
| `bedrock-agentcore` PyPI dep | ✅ | `local_scaffold._gen_pyproject` → `"bedrock-agentcore>=0.1"` |

---

## Per-Component Detail

### 1. AgentCore Runtime ✅

**File map:**
- `engine/engine/pipeline/compiler/runner_gen.py` emits `agent/runner.py`:
  ```python
  from bedrock_agentcore.runtime import BedrockAgentCoreApp
  app = BedrockAgentCoreApp()

  @app.entrypoint
  async def invoke(payload, session_context): ...

  if __name__ == "__main__":
      app.run()
  ```
- `engine/engine/pipeline/iac_generator.py::_gen_agentcore_tf` emits
  `infra/agentcore.tf`:
  ```hcl
  resource "aws_bedrockagentcore_agent_runtime" "agent" {
    agent_runtime_name = var.agent_name
    agent_runtime_artifact { container_configuration { container_uri = var.ecr_image_uri } }
    network_configuration { network_mode = "PUBLIC" }
    protocol_configuration { server_protocol = "HTTP" }
    environment_variables = { ... MEMORY_ID, GATEWAY_ID ... }
    role_arn = aws_iam_role.agentcore_execution.arn
  }
  ```
- `engine/engine/pipeline/local_scaffold.py::_gen_dockerfile` emits a
  `python:3.12-slim` image with `CMD ["python", "-m", "agent.runner"]` on
  port 8080.
- `_gen_lambda_tf` emits **no agent Lambda** — only per-tool Lambdas.

**Tests:** `test_runner_uses_agentcore_app`,
`test_streaming_runner_uses_agentcore_streaming_entrypoint`,
`test_rag_agent_runner_uses_agentcore_runtime`,
`test_rag_agent_no_lambda_for_agent`,
`test_rag_agent_dockerfile_runs_agentcore_app`.

---

### 2. AgentCore Memory ✅

**Triggered by:** `agent.memory.enabled = true` on any agent node.

**File map:**
- `node_gen._gen_agent` (memory branch) emits `agent/nodes/{nid}.py`:
  ```python
  from bedrock_agentcore.memory import MemoryClient
  _memory = MemoryClient(region_name=AWS_REGION) if MEMORY_ID else None

  records = _memory.retrieve_memories(
      memory_id=MEMORY_ID, namespace=_NAMESPACE, query=query_text, top_k=_TOP_K,
  )
  _memory.create_event(
      memory_id=MEMORY_ID, actor_id=actor_id, session_id=session_id,
      messages=[(query_text, "USER"), (response_text, "ASSISTANT")],
  )
  ```
- `runner_gen` extracts `actor_id` from `session_context.actor_id` /
  `user_id` (or payload fallback) and `session_id` from
  `session_context.session_id`.
- `state_gen` adds `actor_id: str` + `session_id: str` to `AgentState`
  when memory is enabled.
- `iac_generator._gen_agentcore_memory_tf` emits strategies:
  - `semantic_memory_strategy` — namespaces `default`, `/actor/{actorId}`
  - `summary_memory_strategy` — `/session/{sessionId}`
  - `user_preference_memory_strategy` — `/actor/{actorId}/preferences`
- IAM: `agent_policy` includes `bedrock-agentcore:RetrieveMemories` +
  `StoreMemories` when memory or any AgentCore feature is enabled.

**Tests:** `test_rag_agent_uses_agentcore_memory_real_api`,
`test_rag_agent_state_carries_actor_and_session`,
`test_rag_agent_runner_propagates_actor_id`,
`test_rag_agent_memory_tf_declares_strategies`,
`test_rag_agent_iac_includes_apigw_agentcore_memory`.

---

### 3. AgentCore Gateway ✅

**Triggered by:** an `mcp_server` node in the graph.

**File map:**
- `node_gen._gen_mcp_server` emits `mcp_server/server.py`:
  ```python
  from bedrock_agentcore.mcp import MCPServer
  server = MCPServer("{name}")

  @server.tool(description="…")
  async def {tool_fn}(input: dict) -> dict: ...
  ```
- `iac_generator._gen_agentcore_gateway_tf` emits
  `infra/agentcore_gateway.tf` with `aws_bedrockagentcore_gateway` +
  `aws_bedrockagentcore_gateway_target` + a dedicated `mcp_server` Lambda
  with its own IAM role + a `lambda_permission` allowing
  `bedrock-agentcore.amazonaws.com` to invoke it.

---

### 4. AgentCore Identity ✅

**Triggered by:** any `tool_http` with `auth.type = oauth2_client_credentials`.

**File map:**
- `tool_gen._gen_tool_http` (oauth2 branch) emits:
  ```python
  from bedrock_agentcore.identity import IdentityClient
  _identity = IdentityClient(region_name=os.environ.get("AWS_REGION", "us-east-1"))

  def _get_oauth2_token() -> str:
      return _identity.get_token(
          provider_name=f"…-{tool_name}-oauth2",
          grant_type="client_credentials", scopes="…",
      )
  ```
- `iac_generator._gen_agentcore_identity_tf` emits
  `infra/agentcore_identity.tf` with `aws_secretsmanager_secret` +
  `aws_bedrockagentcore_oauth2_credential_provider` per OAuth2 tool.

---

### 5. Code Interpreter & Browser Tool ✅

**Catalog:** `code_interpreter` and `browser_tool` node types in
`studio/src/nodes/catalog.ts` (Agents & Orchestration category).

**Generated code:**
```python
# code_interpreter
from bedrock_agentcore.tools import CodeInterpreterClient
_code_interpreter = CodeInterpreterClient()
response = await _code_interpreter.invoke_async(code=code, timeout_seconds=N)

# browser_tool
from bedrock_agentcore.tools import BrowserClient
_browser = BrowserClient()
response = await _browser.invoke_async(action=action, url=url, **extra)
```

**IAM:** `agent_policy` includes `bedrock-agentcore:InvokeCodeInterpreter`
+ `InvokeBrowser` when these nodes are present.

---

### 6. AgentCore Observability ✅

**File map:**
- `engine/engine/pipeline/observability.py` emits `agent/observability.py`:
  ```python
  from bedrock_agentcore.observability import configure as _configure_observability
  _configure_observability(
      service_name=_AGENT_NAME,
      enable_genai_spans=True,
      enable_langchain_instrumentation=True,
  )
  ```
- Side-effect import prepended to `agent/runner.py`.
- `pyproject.toml` does **not** include `langsmith`. `.env.example` does
  **not** include `LANGCHAIN_*` vars.

**Tests:** `test_observability_uses_agentcore_not_langsmith`,
`test_pyproject_drops_langsmith`, `test_env_example_drops_langsmith`.

---

### 7. S3 Vectors ✅

**File map:**
- `node_gen._gen_kb_s3_vector`:
  ```python
  import boto3
  from langchain_aws.embeddings import BedrockEmbeddings
  _embeddings = BedrockEmbeddings(model_id="…")
  _s3v = boto3.client("s3vectors", region_name=AWS_REGION)

  query_vec = _embeddings.embed_query(query_text)
  response = _s3v.query_vectors(
      vectorBucketName="…", indexName="…",
      queryVector={"float32": query_vec}, topK=5, returnMetadata=True,
  )
  ```
- Terraform: S3 Vectors index is **expected to exist**; the platform does
  not provision it (no AWS provider resource as of 2026-05-06; track
  [terraform-provider-aws #43438](https://github.com/hashicorp/terraform-provider-aws/issues/43438)).
  Customers create the index manually or via a `null_resource` shim.

**Tests:** `test_rag_agent_emits_kb_node_querying_s3vectors`.

---

## What Remains Lambda-Hosted

Only when no AgentCore primitive exists:

- **Per-tool Lambdas** (`tool_custom`, `tool_athena`, `tool_s3`, `tool_http`,
  `tool_bedrock`) — one each, least-privilege IAM, since AgentCore has no
  generic per-tool function primitive.
- **`agentcore_invoker` Lambda** (~80 lines) — bridges API Gateway HTTP
  requests to `bedrock-agentcore:InvokeAgentRuntime`. Stateless. Skip it
  by invoking the AgentCore Runtime endpoint directly via SigV4 / A2A.
- **`mcp_server` Lambda** — only when `mcp_server` node present;
  AgentCore Gateway target.

---

## Outstanding Items (Not Blocking)

- **S3 Vectors index Terraform:** no AWS provider resource yet. Customers
  create the index manually. Watch the upstream issue.
- **AgentCore Runtime feature flag:** customer's account must have the
  AgentCore feature enabled before `terraform apply`.
- **HITL persistence:** still uses LangGraph `DynamoDBSaver` for
  `interrupt()` resume. AgentCore Runtime sessions handle thread state for
  non-HITL graphs; a future revision could replace DDB with AgentCore
  session storage when LangGraph adds an AgentCore checkpointer.
- **ElastiCache cache backend** still deferred — `cache` node remains
  DynamoDB-only.

---

## How to Verify

```bash
cd engine
uv sync
uv run pytest tests/ -v
# 43 passed
```

Spot-check generated artifacts:

```bash
# Build a RAG agent in the Studio (or use the test fixtures), Generate ZIP, then:
unzip agent-rag-agent-*.zip -d /tmp/rag
grep -r "BedrockAgentCoreApp" /tmp/rag/agent/
grep -r "create_event" /tmp/rag/agent/nodes/
grep -r "memory_strategies" /tmp/rag/infra/
grep -r "aws_lambda_function.\"agent\"" /tmp/rag/infra/   # should be empty
grep -r "langsmith\|LANGCHAIN" /tmp/rag/                  # should be empty
```
