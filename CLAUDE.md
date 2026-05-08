# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project Status

**Implementation phase.** Engine + Studio are running. The spec
(`generative-agents-platform-spec.md`) records original intent; the source
of truth for current behavior is the code. When code and spec disagree,
trust the code and update the spec.

## What This Is

Self-hosted, low-code platform installed via Terraform into a customer's AWS
account. Users design generative AI agents on a drag-and-drop canvas; the
engine compiles the graph to a deployable ZIP (Python + Terraform + Docker)
that runs entirely in the customer's account on **Amazon Bedrock AgentCore**.

## Four-Layer Architecture

```
Studio (React/TypeScript SPA)
    ↓ Graph JSON (DAG) via /validate, /generate
Code Generation Engine (Python/FastAPI)
    ↓ agent-{name}-{ts}.zip
Generated Artifacts (Python + Terraform + Docker)
    ↓ terraform apply
AWS Runtime (AgentCore Runtime + Memory + Gateway + Identity + Bedrock + S3 Vectors)
```

| Layer | Output | Technology |
|---|---|---|
| Studio | Graph DAG JSON, ZIP import | React, TypeScript, React Flow, JSZip |
| Code Generation Engine | ZIP bundle | Python 3.12, FastAPI |
| Generated Artifacts | Deployable agent | LangGraph, bedrock-agentcore SDK, boto3, Terraform |
| AWS Runtime | Live agent | AgentCore Runtime + Memory + Gateway, Bedrock, per-tool Lambdas, DynamoDB (HITL/cache only) |

## Platform Tech Stack

**Frontend (Studio):** React 18, TypeScript, React Flow (canvas),
schema-driven config forms, JSZip for ZIP import. Help panel modal
(`?` shortcut). Git modal (push/pull GitHub or GitLab). Engine health
indicator (polls `/health` every 15s). Global errors banner over the
canvas for graph-level validation errors. Talks to engine over
`VITE_API_BASE` env var (build-time inlined by Vite); falls back to
`/api` for local Vite proxy → port 8000.

**Backend (Engine):** Python 3.12+, FastAPI. Endpoints: `GET /health`,
`POST /validate`, `POST /generate` (returns ZIP), `POST /git/push`,
`POST /git/pull`. Mangum adapter for Lambda deploy; uvicorn for local;
Dockerfile + HF Space frontmatter for Hugging Face Spaces deploy.

**CORS:** `engine/main.py::_cors_origins()` reads the `CORS_ORIGINS` env
var (comma-separated). Defaults to localhost Vite ports when unset. Set
to the deployed Studio origin in production.

## Generated Artifact Tech Stack

Generated agents use:
- **Runtime host:** Amazon Bedrock AgentCore Runtime (container, not Lambda)
- **Framework:** LangGraph + LangChain (ReAct pattern)
- **AgentCore SDK:** `bedrock-agentcore` (PyPI) — Runtime, Memory, Identity, Code Interpreter, Browser, MCP server
- **LLM:** Amazon Bedrock (Claude, Titan) — Bedrock-only for v1
- **HTTP server (in container):** `BedrockAgentCoreApp` on `0.0.0.0:8080`
- **Dependency manager:** uv
- **Testing:** pytest + moto (AWS mocks) + responses (HTTP mocks)
- **Container base:** `python:3.12-slim` running `python -m agent.runner`
- **Observability:** AgentCore Observability auto-instrumentation → CloudWatch GenAI Observability (no LangSmith)

## Generated Artifact ZIP Structure

```
agent-{name}-{timestamp}.zip
├── agent/              ← LangGraph package: graph.py, state.py, config.py, runner.py, observability.py, nodes/{node_id}.py
├── tools/              ← Tool implementations ({tool_name}.py)
├── mcp_server/         ← Generated only when an mcp_server node is present
├── infra/              ← Terraform: main.tf, agentcore.tf, agentcore_memory.tf, agentcore_gateway.tf, agentcore_identity.tf, api_gateway.tf, lambda.tf, iam.tf, ecr.tf, dynamodb.tf, ...
├── tests/              ← pytest files, one per tool node
├── local/              ← Local simulation: run_agent.py, run_workflow.py, mock_tools.py
├── Dockerfile          ← python:3.12-slim → CMD ["python","-m","agent.runner"]
├── pyproject.toml      ← uv-managed dependencies (requires-python = ">=3.12"); bedrock-agentcore included
├── .env.example        ← AgentCore env vars (no LangSmith)
└── project.json        ← Re-import schema
```

## Hosting Model

**Agent runs on AgentCore Runtime container, not Lambda.** The Dockerfile
launches `BedrockAgentCoreApp.run()` on :8080. AgentCore Runtime provides:

- 8-hour managed sessions (replaces LangGraph DynamoDB checkpointer in the no-HITL case)
- Auto-scaling and request streaming
- A2A protocol invocation
- Built-in CloudWatch GenAI Observability (replaces LangSmith)
- `session_context` injected per invocation (`session_id`, `actor_id`)

Public HTTP fronting is API Gateway → thin `agentcore_invoker` Lambda →
`bedrock-agentcore:InvokeAgentRuntime`. Direct callers (A2A, SigV4) can
bypass API GW and hit `agentcore_runtime_endpoint` directly.

**Lambdas remaining in the stack:**
- One per tool node (`tool_*`), least-privilege IAM role each
- `agentcore_invoker` (API GW bridge), tiny stateless proxy
- `mcp_server` (only when an `mcp_server` node exists)

## Commands for Generated Agents

These commands run inside an extracted agent ZIP, not the platform itself:

```bash
# Test
uv run pytest tests/ -v

# Local run with mocked AWS
uv run python local/run_agent.py --input '{"message": "..."}' --mock-tools

# Local run with real AWS
AWS_PROFILE=dev uv run python local/run_agent.py --input '{"message": "..."}'

# Local HTTP server (matches what AgentCore Runtime executes in prod)
docker build -t my-agent .
docker run -p 8080:8080 --env-file .env my-agent

# Deploy
cd infra/
terraform init -backend-config=backend.hcl
terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars
```

## Code Generation Pipeline (Engine internals)

Seven sequential phases when user clicks "Generate":

1. **Validator** — topological sort, type-check edges, required fields, security checks
2. **Graph Compiler** — emits Python: state schema, node functions, LangGraph assembly, AgentCore runner
3. **IaC Generator** — Terraform modules: AgentCore Runtime/Memory/Gateway/Identity, API GW, IAM, ECR, per-tool Lambdas
4. **Test Generator** — pytest files with moto mocks, one file per tool node
5. **Local Runner Scaffold** — Dockerfile, pyproject.toml, local/ scripts, .env.example
6. **Observability Injector** — adds `agent/observability.py` with `bedrock_agentcore.observability.configure(...)`; prepends side-effect import to runner
7. **ZIP Bundler** — packages all artifacts + `project.json` (re-import schema)

### Graph Compiler output structure (`agent/`)

- `state.py` — `MessagesState` subclass with one field per non-message edge port. When any agent node has `memory.enabled=true`, also includes `actor_id: str` and `session_id: str` (populated by runner from AgentCore `session_context`)
- `nodes/{node_id}.py` — one async function per node: `async def node_{id}(state: AgentState) -> dict` returning only keys this node writes
- `graph.py` — `StateGraph` assembly; `condition` nodes compile to routing functions returning branch name strings (not state mutations); `DynamoDBSaver` checkpointer injected only when HITL nodes exist
- `runner.py` — `BedrockAgentCoreApp` with `@app.entrypoint` (and `@app.streaming_entrypoint` when `agent.streaming=true`). `if __name__ == "__main__": app.run()` for container start. **No `lambda_handler`.**
- `config.py` — `AWS_REGION`, `AGENT_NAME`, conditional `MEMORY_ID`/`GATEWAY_ID`, lazy `get_secret()` via `lru_cache`

Compilation errors surface as structured JSON with `node_id`, `field`,
`code`, `message` — displayed as inline validation markers in the Studio
before generation is attempted.

## Node Types (Canvas)

27 node types, grouped by category:

- **Input / Output:** `input`, `output`
- **Agents & Orchestration:** `agent`, `multi_agent_coordinator`, `human_in_the_loop`, `code_interpreter`, `browser_tool`
- **Tools:** `tool_custom` (Python Lambda), `tool_athena` (SQL), `tool_s3`, `tool_http`, `tool_bedrock`
- **MCP:** `mcp_server`, `mcp_client`
- **Knowledge Base / RAG:** `kb_s3_vector`, `kb_bedrock`, `chunking`, `embedding`, `retriever`
- **Ingestion Pipelines:** `s3_source`, `document_parser`, `ingest_pipeline`
- **Flow Control:** `condition`, `loop`, `cache`, `logger`

## Critical Implementation Invariants

Non-obvious constraints the compiler and engine must enforce exactly:

**`human_in_the_loop` requires DynamoDB checkpointer.** Compiler detects HITL
nodes and injects `DynamoDBSaver` into `graph.compile(checkpointer=...)`.
Without it, `interrupt()` cannot persist state and the workflow cannot
resume. Graphs without HITL nodes must omit the checkpointer (AgentCore
Runtime sessions handle thread persistence).

**Agent runs on AgentCore Runtime, never on Lambda.** The IaC generator
emits no `aws_lambda_function.agent`. Routing goes through API GW →
`agentcore_invoker` Lambda → `bedrock-agentcore:InvokeAgentRuntime`. Any
regression that re-introduces an agent Lambda breaks observability + session
semantics.

**`tool_athena` must use `?` positional placeholders via `ExecutionParameters`.**
String-formatted queries are prohibited — SQL injection vector. Compiler
rejects any `query_template` that uses f-string-style interpolation.

**`condition` node expressions: `jmespath` or `cel` only.** Generating
`eval()`-based Python execution is explicitly prohibited — allows arbitrary
code execution from the canvas.

**`loop` node ports are two separate subgraph edges.** `item` (per-iteration)
and `results` (post-loop aggregate) use LangGraph's Send API. A downstream
node cannot be wired to both simultaneously.

**`inference_profile_arn` takes precedence over `model_id`.** When set on
`agent` or `tool_bedrock` nodes, the inference profile ARN must be passed
to the Bedrock call instead of `model_id`. Required for cross-region
inference.

**Secrets fetched lazily via `lru_cache`, never at module import time.**
Generated `config.py` wraps `secretsmanager.get_secret_value()` in
`@functools.lru_cache`. Avoids Secrets Manager API calls on cold start.

**OAuth2 tokens for `tool_http` are vended by AgentCore Identity, not by
manual `httpx.post`.** The generated `tool_http` code calls
`bedrock_agentcore.identity.IdentityClient.get_token(provider_name=…,
grant_type='client_credentials')`. Token caching, refresh, and rotation are
managed by AgentCore Identity. The credential provider
(`aws_bedrockagentcore_oauth2_credential_provider`) is created in
`infra/agentcore_identity.tf`.

**AgentCore Memory uses real SDK API.** When `agent.memory.enabled=true`,
the agent node calls `MemoryClient(region_name=…).create_event(memory_id,
actor_id, session_id, messages=[(text, "USER"|"ASSISTANT")])` per turn and
`retrieve_memories(memory_id, namespace, query, top_k)` for recall.
`actor_id` and `session_id` flow from `session_context` → runner → state →
node. Terraform memory resource declares semantic + summary +
user_preference strategies.

**Each tool node generates exactly one Lambda with its own IAM role.** No
shared execution roles across tools or agents. Agent itself has no Lambda.

## project.json Versioning

Generated ZIPs include `project.json` for round-trip import. Studio
**Import ZIP** button (uses JSZip client-side) reads it and rehydrates the
canvas. Schema uses semantic versioning. The Studio enforces
`schema_version` major ≤ supported major (currently 1) and rejects newer
schemas. Edge node references are validated on import. Migration chain
(planned): `platform/migrations/v{from}_to_v{to}.py` with `migrate(project:
dict) -> dict`.

## Security Constraints

- IAM roles are per-agent, least-privilege — no wildcard resource ARNs in any generated policy
- All credentials via IAM roles + Secrets Manager + AgentCore Identity — no hardcoded values
- Bedrock Guardrails are optional but architecture must support them (pass `guardrailConfig` to every Bedrock invocation when configured)
- TLS 1.2+ in transit, SSE-S3/SSE-KMS at rest
- `.env.example` contains placeholder values only — never real secrets

## Key Design Decisions (from spec)

- **Single-tenant only** — no multi-workspace, no RBAC in v1
- **Bedrock-only LLM** in v1 — architecture must be provider-agnostic for future extensibility
- **AgentCore-first** — every component with an AgentCore primitive uses it. Lambda is reserved for tool nodes only.
- **Customer owns generated code** — no license restrictions on ZIP contents
- **Self-hosted** — zero external SaaS runtime dependencies after install (no LangSmith, no third-party tracing)
- **Streaming:** when `agent.streaming=true`, runner emits `@app.streaming_entrypoint` (AgentCore Runtime handles transport, backpressure, reconnection — no Lambda response-streaming gymnastics)

## Hosting (current free deploy)

Studio: **Cloudflare Workers Assets** via [studio/wrangler.toml](studio/wrangler.toml).
SPA fallback via `not_found_handling = "single-page-application"` (NOT
`_redirects` — Workers Assets rejects the recursive rule). Engine URL
inlined at build via [studio/.env.production](studio/.env.production)
(committed; engine URL is public). Cloudflare Workers Assets does NOT
support runtime variables on assets-only deploys, so build-time env via
the file is the working path.

Engine: **Hugging Face Spaces** Docker SDK. [engine/Dockerfile](engine/Dockerfile)
binds 0.0.0.0:7860 (HF requires this). [engine/README.md](engine/README.md)
contains the YAML frontmatter (`sdk: docker`, `app_port: 7860`).
Deployed via `git subtree split --prefix=engine HEAD` then
`git push hf <sha>:main`.

CORS wired through `CORS_ORIGINS` env var on the HF Space pointing to the
Cloudflare Workers URL. See [docs/user-guide.md](docs/user-guide.md) for
end-to-end deploy steps.

## Git Integration

`POST /git/push` and `POST /git/pull` in [engine/engine/main.py](engine/engine/main.py).
Providers in [engine/engine/integrations/git.py](engine/engine/integrations/git.py):
- `GitHubClient`: REST v3 via Trees API (atomic blob → tree → commit → ref update)
- `GitLabClient`: REST v4 single-call Commits API w/ `create`/`update` actions

Both auto-create the target branch off the repo default if missing. Tokens
(PATs) are passed per-request and never persisted server-side. Stdlib
`urllib` only — no new deps. `GitProviderError` surfaces upstream HTTP
status + body verbatim so 401/404/422 are diagnosable in the UI.

Studio modal: [studio/src/components/GitPanel/GitPanel.tsx](studio/src/components/GitPanel/GitPanel.tsx).
Tokens stored in browser `localStorage` keyed per provider. Pull confirms
before overwriting the canvas. Result links to the produced commit URL.

Tests: [engine/tests/test_git_integration.py](engine/tests/test_git_integration.py)
(13 tests w/ urllib stub) — covers branch auto-create, atomic commit shape,
provider auth errors, endpoint validation. Full engine suite: 56/56.

## Open Items Affecting Implementation

- Lambda 15-minute limit no longer relevant for the agent path (AgentCore Runtime sessions are 8h). Still applies to per-tool Lambdas; complex `tool_custom` work should consider Step Functions or async return.
- ElastiCache cache backend deferred — `cache` node is DynamoDB-only in v1
- AgentCore Terraform provider version: requires `aws` provider with AgentCore feature flag enabled. Verify customer account has AgentCore enabled before `terraform apply`.
