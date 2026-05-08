# Generative Agents Platform — User Guide

## What Is This

Self-hosted, low-code platform for designing and deploying generative AI
agents on AWS. Design visually in the **Studio**, click **Generate ZIP**,
and receive a ready-to-deploy bundle containing Python code, Terraform
infrastructure, and a Docker container — all running in your own AWS
account on **Amazon Bedrock AgentCore**.

```
Studio (browser) ──► Generate ZIP ──► terraform apply ──► Live agent on AgentCore Runtime
```

No external SaaS runtime dependency. No LangSmith. You own the generated code.

---

## Quick Start

### 1. Run the Engine (backend)

```bash
cd engine
pip install uv          # if not installed
uv sync
uv run uvicorn engine.main:app --reload --port 8000
```

Engine listens at `http://localhost:8000`. Health check:
`curl http://localhost:8000/health`.

### 2. Run the Studio (frontend)

```bash
cd studio
npm install
npm run dev
```

Studio at `http://localhost:5173`.

---

## Hosting the Platform (free)

Two-tier free deploy: Studio on Cloudflare Workers (Assets), engine on
Hugging Face Spaces (Docker SDK). Generated agents target the customer's
own AWS account separately — billing for Bedrock/AgentCore is the
customer's, not the platform host's.

### A. Studio → Cloudflare Workers (Assets)

The Studio repo is wired for Cloudflare Workers Assets via
[studio/wrangler.toml](../studio/wrangler.toml):

```toml
name = "agents-studio"
compatibility_date = "2025-01-01"

[assets]
directory = "./dist"
not_found_handling = "single-page-application"
```

**Project setup (one-time):**

1. Cloudflare dashboard → **Workers & Pages** → **Create**.
2. **Connect to Git** → pick your fork.
3. Build configuration:

| Field | Value |
|---|---|
| Root directory | `studio` |
| Build command | `npm install && npm run build` |
| Deploy command | `npx wrangler deploy` |

4. **Save and Deploy.** Studio publishes to
   `https://agents-studio.<account>.workers.dev`.

**Engine URL** is baked at build time via Vite. The repo ships
[studio/.env.production](../studio/.env.production) with
`VITE_API_BASE=https://<your-hf-user>-agents-engine.hf.space`. Edit it
to your HF Space URL before pushing, or fork and override.

> **Why a committed `.env.production` and not a build-time variable?**
> Cloudflare Workers Assets blocks runtime variables on assets-only
> deploys ("Variables cannot be added to a Worker that only has static
> assets"). Vite reads `.env.production` during `vite build` and inlines
> the value into the JS bundle. The engine URL is public anyway — no
> secret to leak.

**Custom domain (free, optional):** Workers project → Settings → Custom
domains. Requires DNS on Cloudflare.

### B. Engine → Hugging Face Spaces (Docker SDK)

The repo ships [engine/Dockerfile](../engine/Dockerfile) and
[engine/README.md](../engine/README.md) with the YAML frontmatter HF
Spaces requires (`sdk: docker`, `app_port: 7860`).

**Space setup (one-time):**

1. https://huggingface.co/new-space → **Owner**, **Space name**
   `agents-engine`, **License** MIT, **SDK: Docker → Blank**, **Public**.
2. Generate a write token at https://huggingface.co/settings/tokens.
3. Add the Space as a git remote on the monorepo and force-push the
   `engine/` subtree on first push (the Space already has a template
   commit):

   ```powershell
   cd "C:\Plataforma Agentica"
   git remote add hf https://USER:TOKEN@huggingface.co/spaces/USER/agents-engine

   # First push — overwrite the template commit
   $sha = git subtree split --prefix=engine HEAD
   git push hf "$sha`:main" --force
   ```

   Bash equivalent:

   ```bash
   git push hf $(git subtree split --prefix=engine HEAD):main --force
   ```

4. Watch the build on the Space page. ~3–5 min for first build (uv
   install). Badge turns **Running**.
5. Probe: `curl https://USER-agents-engine.hf.space/health` →
   `{"status":"ok",...}`.

**Configure CORS so Cloudflare-hosted Studio can call the engine:**
Space → **Settings** → **Variables and secrets** → add a variable:

| Name | Value |
|---|---|
| `CORS_ORIGINS` | `https://agents-studio.<your-account>.workers.dev` (comma-separate to allow more origins) |

The engine reads `CORS_ORIGINS` at startup; falls back to local Vite
ports when unset. Save → Space restarts (~30s).

**Subsequent updates** (no force flag, fast-forwards):

```powershell
$sha = git subtree split --prefix=engine HEAD
git push hf "$sha`:main"
```

### C. Wire Studio → Engine

The committed `.env.production` already points to the standard HF Space
URL. After both deploys finish, open the Studio URL — the **engine health
dot** in the toolbar turns green within 15s. If red, check:

- HF Space is **Running** (not sleeping — first wake takes ~10s)
- `CORS_ORIGINS` includes the **exact** Cloudflare URL (no trailing slash)
- `VITE_API_BASE` value in `.env.production` matches the HF Space URL

### D. Caveats

- HF free tier sleeps after ~48 h idle; first request after sleep is slow.
- HF public Space = public source. Pro plan ($9/mo) for private Spaces.
- Cloudflare Workers Assets free tier: 100k requests/day, generous bandwidth.
- Generated agents themselves run on the **customer's** AWS account; that
  bill is separate and not on the free tier (Bedrock + AgentCore are paid).

---

## Studio Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Toolbar  [name]  ●Engine  [⬆Import] [🔀Git] [✓Validate] [⬇Generate] [?]      │
├────────────┬────────────────────────────────────────┬────────────────────────┤
│            │                                        │                        │
│   Node     │   Canvas (red banner: graph errors)    │   Config Panel         │
│   Panel    │   (drag-and-drop area)                 │   (selected node)      │
│            │                                        │                        │
└────────────┴────────────────────────────────────────┴────────────────────────┘
```

| Area | Purpose |
|---|---|
| **Node Panel** (left) | Catalog of node types grouped by category. Drag onto canvas. |
| **Canvas** (center) | Compose the agent by connecting nodes with edges. Top-banner surfaces graph-level validation errors. |
| **Config Panel** (right) | Edit the selected node's parameters. Reads from current canvas for `node_ref_list` pickers (e.g. agent's tools). |
| **Toolbar** (top) | Project name, engine health dot, Import ZIP, **🔀 Git**, Validate, Generate ZIP, Help. |
| **Help Panel** (`?`) | Modal docs: Quickstart, Building Workflows, Node Reference, Examples, Deploy, Troubleshooting. |
| **Engine health dot** | Green = engine reachable on `/api/health`; red = engine offline (Validate/Generate/Git/Pull will fail). Polls every 15s. |

Keyboard shortcuts:
- `?` — open Help (when not typing in a field)
- `Esc` — close any modal
- `Delete` / `Backspace` — remove selected node or edge

---

## Building an Agent

### Step 1 — Add nodes

Drag from the **Node Panel** onto the **Canvas**. Every graph needs at
minimum one **Input** node and one **Output** node.

### Step 2 — Connect nodes

Drag from an output port (right side of a node) to an input port (left
side of another node).

| Color | Type | Meaning |
|---|---|---|
| Blue | `string` | Plain text |
| Orange | `json` | Structured data |
| Purple | `document` | Parsed document object |
| Teal | `vector` | Embedding vector |
| Pink | `retriever` | Vector store retriever handle |
| Green | `boolean` | Boolean flag |
| Gray | `any` | Accepts any type |

A connection is rejected when source and target types differ and neither is
`any`. To bridge incompatible types, route through a node whose port is
`any` (logger, condition) or change the port type in the node config.

### Step 3 — Configure nodes

Click a node to open its form in the right panel. Required fields are
marked. Click `?` in the panel header to see compatible upstream/downstream
ports for the node.

### Step 4 — Validate

Click **✓ Validate**. The engine checks:

- DAG has no cycles
- All required fields are filled
- Edge port types are compatible
- Security constraints (Athena `?` placeholders, condition expression language, cache backend)

Errors appear as red badges on the affected nodes and as a count in the
toolbar. Common error codes are listed in [Troubleshooting](#troubleshooting).

### Step 5 — Generate

Click **⬇ Generate ZIP**. The engine produces
`agent-{name}-{timestamp}.zip` and downloads it.

### Step 6 — Re-edit a generated agent

Click **⬆ Import ZIP** and select a previously generated bundle. The Studio
unpacks `project.json` (client-side via JSZip), validates the schema, and
restores nodes, edges, configs, and project name. Importing replaces the
current canvas after a confirmation prompt.

### Step 7 — Push the generated repo to GitHub or GitLab

Click **🔀 Git** in the toolbar. Modal has provider switcher (GitHub /
GitLab) and Push / Pull tabs. Tokens are persisted in browser
`localStorage` only; the engine forwards them once per request and never
stores them.

**Create a Personal Access Token first:**

| Provider | Token type | Scopes |
|---|---|---|
| **GitHub** | Settings → Developer settings → **Tokens (fine-grained)** | `Contents: read & write` on the target repo |
| **GitLab** | User settings → Access Tokens | `api` |

**Push tab** — runs the full code-gen pipeline server-side, then commits
every generated file (Python, Terraform, tests, Docker, `.env.example`,
`project.json`) in **one atomic commit** to the chosen branch.

| Field | Value |
|---|---|
| Repo | `owner/name` (GitHub) or `group/project` / nested path (GitLab) |
| Branch | Auto-created off the default branch if missing |
| Commit message | Free text |
| Base URL (GitLab only) | `https://gitlab.com` (default) or self-hosted URL |

**Pull tab** — reads `project.json` (or any path) from the repo and
hydrates the canvas. Use to round-trip-edit a previously pushed repo
without downloading the ZIP. Confirms before overwriting the canvas.

| Field | Value |
|---|---|
| Ref | Branch, tag, or commit SHA. Default `main`. |
| Path | Default `project.json`. |

---

## Node Reference

### Input / Output

#### Input
Entry point. Choose the trigger:

| Trigger | When it fires |
|---|---|
| `http` | API Gateway POST request → AgentCore invoker Lambda → AgentCore Runtime |
| `s3_event` | S3 bucket object created/removed |
| `sqs` | Message arrives on SQS queue |
| `schedule` | Cron or rate expression (EventBridge) |

Output port: **Payload** (`json`).

#### Output
Terminal node:

| Mode | Behavior |
|---|---|
| `json` | Returns JSON body with HTTP status code |
| `stream` | Streams tokens (requires `streaming=true` on agent) |
| `s3_file` | Writes result to S3 and returns the object key |

---

### Agents & Orchestration

#### Agent
LangGraph ReAct agent backed by Amazon Bedrock, hosted on AgentCore Runtime.

| Field | Description |
|---|---|
| **Bedrock model ID** | e.g. `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| **Inference profile ARN** | Cross-region inference; takes precedence over model ID. Format: `arn:aws:bedrock:{region}:{account}:inference-profile/{id}` |
| **System prompt** | LLM instructions. Supports `{{variable}}` interpolation. |
| **Temperature** | 0.0–1.0. Default 0.7. |
| **Max tokens** | Default 4096. |
| **Streaming** | When enabled, runner emits `@app.streaming_entrypoint`. AgentCore Runtime handles transport. |
| **Guardrail ID / Version** | Optional Bedrock Guardrails. |
| **Memory enabled** | When true, uses **AgentCore Memory** (semantic + summary + user_preference strategies) — not DynamoDB checkpointing. See [AgentCore Memory](#agentcore-memory). |
| **Memory namespace** | Memory namespace pattern (default `default`). Supports placeholders like `/actor/{actorId}`. |

#### Multi-Agent Coordinator
Supervisor that routes tasks to worker agent nodes. Workers listed in
`workers` config.

#### Human in the Loop
Pauses workflow and sends a notification awaiting human approval.

| Field | Description |
|---|---|
| **Notification method** | `email`, `sns`, or `slack_webhook` |
| **Notification target** | Email, SNS topic ARN, or webhook URL |
| **Timeout** | Seconds before auto-resolve. Default 86400. |
| **Timeout action** | `approve` or `reject` on timeout. |

> Graphs with HITL nodes get a DynamoDB checkpointer injected into
> `graph.compile(checkpointer=...)`. Required for `interrupt()` to persist
> state across the human pause.

#### Code Interpreter
Executes Python in an **AgentCore managed sandbox**. No infrastructure to
provision. Generated code calls
`bedrock_agentcore.tools.CodeInterpreterClient.invoke_async(...)`.

#### Browser Tool
Navigates web pages via **AgentCore managed headless browser**. Generated
code calls `bedrock_agentcore.tools.BrowserClient.invoke_async(...)`.

---

### Tools

Tools are functions the Agent can call during its reasoning loop. Reference
tool nodes in the Agent's **Tools** field by node ID.

Each tool node generates exactly one Lambda with a least-privilege IAM
role.

#### Custom Tool
Python function deployed as a Lambda — inline code or existing Lambda ARN.

#### Athena Query
Parameterized SQL on Amazon Athena.

> **Security:** use `?` positional placeholders.
> ✅ `SELECT * FROM orders WHERE customer_id = ?`
> ❌ `SELECT * FROM orders WHERE customer_id = '{customer_id}'`
> String interpolation is rejected by the validator (`UNSAFE_QUERY_TEMPLATE`).

#### S3 Tool
Read / write / list objects in an S3 bucket. Key template supports
`{{variable}}` interpolation.

#### HTTP Tool
External REST API. Auth options:
- `none`
- `api_key` via Secrets Manager (`secret://name`)
- `bearer` via Secrets Manager
- `oauth2_client_credentials` — **vended by AgentCore Identity** (no manual
  token caching). Provider configured in `infra/agentcore_identity.tf`.

#### Bedrock Tool
Direct Bedrock API call — `invoke_model`, `invoke_agent`, or
`invoke_model_with_response_stream`.

---

### MCP

#### MCP Server
Generates `mcp_server/server.py` that exposes the agent's tool nodes via
the Model Context Protocol. Deployed on **AgentCore Gateway** as a Lambda
target — external systems call REST and Gateway translates to MCP.

#### MCP Client
Connects to an external MCP server using `langchain-mcp-adapters` and
exposes its tools to your agent. Reference the MCP client node in the
agent's `tools` config.

---

### Knowledge Base / RAG

```
S3 Vector Store ──┐
                  ├──► Retriever ──► Agent
Bedrock KB ───────┘
```

#### S3 Vector Store
Connects to an **Amazon S3 Vectors** index. Generated code uses the boto3
`s3vectors` client (`query_vectors` with `BedrockEmbeddings`-derived query
vector). No FAISS, no custom vector DB.

#### Bedrock Knowledge Base
Managed Bedrock KB. Generated code uses
`AmazonKnowledgeBasesRetriever` from `langchain-aws`.

#### Chunking
Splits documents (`fixed_size`, `semantic`, `by_section`).

#### Embedding
Vectorizes via Bedrock embedding model (default
`amazon.titan-embed-text-v2:0`).

#### Retriever
Runs a semantic query against a vector store. Inputs: `query`, `retriever`
handle. Output: `documents`.

---

### Ingestion Pipelines

```
S3 Source ──► Document Parser ──► Chunking ──► Embedding ──► (output writes to S3 Vectors index)
```

S3 Source emits `document`-typed objects. Chain through chunking and
embedding to produce vectors that the runtime ingests into an S3 Vectors
index.

---

### Flow Control

#### Condition
Routes based on a JMESPath or CEL expression. `eval()` is prohibited.
Outputs branches **True** and **False**.

> Condition nodes compile to LangGraph routing functions, not graph nodes.
> They don't appear in execution traces — they decide which branch fires.

#### Loop
Fan-out iteration over a list. Output ports:
- **Item** — per-iteration processing target
- **Results** — aggregated list after all iterations

> Don't wire a downstream node to both ports simultaneously.

#### Cache
DynamoDB-backed cache. On hit, skips computation. v1: DynamoDB only
(ElastiCache deferred).

#### Logger
Emits structured CloudWatch log entry; passes payload through unchanged.

---

## AgentCore Components in Generated Stack

The generated bundle uses every AgentCore primitive that has a matching
node-type or invariant:

| AgentCore primitive | Where it appears |
|---|---|
| **Runtime** | Always. `aws_bedrockagentcore_agent_runtime` hosts the agent container. `BedrockAgentCoreApp` in `agent/runner.py`. |
| **Memory** | When any agent has `memory.enabled=true`. `aws_bedrockagentcore_memory` w/ semantic + summary + user_preference strategies. `MemoryClient.create_event` + `retrieve_memories` per turn. |
| **Gateway** | When an `mcp_server` node exists. `aws_bedrockagentcore_gateway` + `aws_bedrockagentcore_gateway_target` bridge REST→MCP. |
| **Identity** | When any `tool_http` uses `oauth2_client_credentials`. `aws_bedrockagentcore_oauth2_credential_provider` + `IdentityClient.get_token`. |
| **Code Interpreter** | When a `code_interpreter` node exists. `CodeInterpreterClient` SDK. |
| **Browser** | When a `browser_tool` node exists. `BrowserClient` SDK. |
| **MCP Server** | When an `mcp_server` node exists. `MCPServer` from `bedrock_agentcore.mcp`. |
| **Observability** | Always. `bedrock_agentcore.observability.configure(...)` auto-instruments LangChain/LangGraph → CloudWatch GenAI. |

### AgentCore Memory

When `agent.memory.enabled=true`:

- Per turn, the agent calls
  `MemoryClient.create_event(memory_id, actor_id, session_id, messages=[(user_text, "USER"), (assistant_text, "ASSISTANT")])`.
- Before invoking the LLM, it calls
  `retrieve_memories(memory_id, namespace, query, top_k)` and prepends
  recalled facts to the prompt.
- `actor_id` and `session_id` come from AgentCore `session_context` (or
  request body fallbacks `actor_id` / `thread_id`). `actor_id` defaults to
  `"anonymous"`.
- Strategies declared in `infra/agentcore_memory.tf`:
  - `semantic_memory_strategy` — facts (namespaces `default`, `/actor/{actorId}`)
  - `summary_memory_strategy` — rolling session summary (`/session/{sessionId}`)
  - `user_preference_memory_strategy` — stable preferences (`/actor/{actorId}/preferences`)
- Long-term extraction runs async after `create_event` — first call stores,
  later calls retrieve.

---

## Generated ZIP Contents

```
agent-{name}-{timestamp}.zip
├── agent/                         ← LangGraph + AgentCore runtime
│   ├── graph.py                   ← StateGraph assembly
│   ├── state.py                   ← MessagesState subclass; actor_id/session_id when memory enabled
│   ├── config.py                  ← AWS_REGION, AGENT_NAME, MEMORY_ID, lazy get_secret
│   ├── runner.py                  ← BedrockAgentCoreApp w/ @app.entrypoint, @app.streaming_entrypoint
│   ├── observability.py           ← bedrock_agentcore.observability.configure(...)
│   └── nodes/                     ← One file per node
├── tools/                         ← Tool implementations (one per tool node)
├── mcp_server/                    ← Generated only when mcp_server node exists
│   └── server.py                  ← bedrock_agentcore.mcp.MCPServer
├── infra/                         ← Terraform
│   ├── main.tf, variables.tf, outputs.tf
│   ├── ecr.tf
│   ├── iam.tf                     ← agentcore_execution role + per-tool roles
│   ├── lambda.tf                  ← Per-tool Lambdas only — NO agent Lambda
│   ├── api_gateway.tf             ← API GW → agentcore_invoker Lambda → InvokeAgentRuntime
│   ├── agentcore.tf               ← aws_bedrockagentcore_agent_runtime
│   ├── agentcore_memory.tf        ← Conditional, w/ memory strategies
│   ├── agentcore_gateway.tf       ← Conditional, when mcp_server node exists
│   ├── agentcore_identity.tf      ← Conditional, when oauth2 tool_http exists
│   └── dynamodb.tf                ← Conditional (HITL or cache)
├── tests/                         ← pytest files
├── local/                         ← run_agent.py, run_workflow.py, mock_tools.py
├── Dockerfile                     ← python:3.12-slim → CMD ["python","-m","agent.runner"]
├── pyproject.toml                 ← uv-managed; bedrock-agentcore included
├── .env.example                   ← AgentCore env vars only (no LangSmith)
└── project.json                   ← Re-import schema
```

---

## Deploying the Generated Agent

### Prerequisites

- AWS account with **Amazon Bedrock AgentCore feature flag enabled**
- AWS CLI configured
- Terraform ≥ 1.9 with AWS provider ≥ 5.x
- `uv`: `pip install uv`
- Docker

### Deploy

```bash
unzip agent-my-agent-20260506120000.zip -d my-agent/
cd my-agent/

# Run tests (optional)
uv run pytest tests/ -v

# Provision infra (creates ECR repo first)
cd infra/
terraform init -backend-config=backend.hcl
terraform apply -var-file=dev.tfvars -target=aws_ecr_repository.agent

# Build & push the AgentCore Runtime container
ECR_URL=$(terraform output -raw ecr_repository_url)
cd ..
docker build -t agent .
docker tag agent:latest $ECR_URL:latest
docker push $ECR_URL:latest

# Apply remaining infra (AgentCore Runtime references the pushed image)
cd infra/
terraform apply -var-file=dev.tfvars
```

### Outputs

| Output | What it is |
|---|---|
| `api_gateway_url` | Public HTTP URL — POST `/invoke` |
| `agentcore_runtime_arn` | Use with `aws bedrock-agentcore invoke-agent-runtime` |
| `agentcore_runtime_endpoint` | Direct A2A / SigV4 endpoint, bypasses API GW |
| `ecr_repository_url` | Where to push the container image |
| `memory_id` *(if memory enabled)* | AgentCore Memory ID |
| `gateway_endpoint` *(if mcp_server present)* | AgentCore Gateway endpoint for MCP clients |

### Invoke

```bash
# Via API Gateway
curl -X POST "$API_GATEWAY_URL/invoke" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "actor_id": "user-42"}'

# Direct AgentCore Runtime (SigV4)
aws bedrock-agentcore invoke-agent-runtime \
  --agent-runtime-arn "$AGENTCORE_RUNTIME_ARN" \
  --payload '{"message": "Hello"}'
```

### Local testing

```bash
# In-process invoke with mocked AWS
uv run python local/run_agent.py --input '{"message": "Hello"}' --mock-tools

# Real AWS via your profile
AWS_PROFILE=dev uv run python local/run_agent.py --input '{"message": "Hello"}'

# Full HTTP server (matches what AgentCore Runtime executes)
docker build -t my-agent .
docker run -p 8080:8080 --env-file .env my-agent
curl -X POST http://localhost:8080/invocations -d '{"message": "Hello"}'
```

---

## Secrets Management

Never put credentials in node config fields. Use Secrets Manager refs:

```
secret://my-secret-name
```

Generated agent fetches secrets lazily via `get_secret(...)` wrapped in
`@functools.lru_cache` — no Secrets Manager call on cold start, cached for
the container lifetime. For OAuth2 tokens, AgentCore Identity vends and
rotates them automatically; no manual cache.

---

## Importing a Generated ZIP

The Studio's **⬆ Import ZIP** button reads `project.json` from any bundle
this platform produced and rehydrates the canvas:

1. Click **⬆ Import ZIP** in the toolbar
2. Confirm overwriting the current canvas (if non-empty)
3. Select the `agent-{name}-{timestamp}.zip` file
4. Canvas restores with all nodes, edges, configuration, and project name

The Studio enforces `schema_version` major ≤ 1 and validates that every
edge node reference exists. Cross-major migrations live in
`platform/migrations/v{from}_to_v{to}.py` (planned).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `MISSING_REQUIRED_FIELD` | Required field empty | Open the node, fill required fields |
| `UNSAFE_QUERY_TEMPLATE` | Athena query uses `{var}` | Replace with `?` placeholders |
| `INVALID_EXPRESSION_LANGUAGE` | Condition language not jmespath/cel | Switch to `jmespath` or `cel` |
| `UNSUPPORTED_CACHE_BACKEND` | Cache backend not `dynamodb` | v1 supports DynamoDB only |
| `CYCLE_DETECTED` | Graph contains a cycle | Remove the back-edge or use a `loop` node |
| `TYPE_MISMATCH` | Edge connects incompatible port types | Route through an `any`-typed port or change port type |
| Generate returns 422 | Validation errors exist | Click Validate, fix all errors first |
| Cannot connect two ports in canvas | Source type ≠ target type and neither is `any` | Drop and re-add the target node, or pick a node with `any` ports |
| Imported ZIP rejected: "newer than this Studio supports" | `project.json schema_version` major exceeds Studio support | Update the Studio |
| Imported ZIP rejected: "ZIP does not contain project.json" | Not generated by this platform | Use a bundle this Studio produced |
| AgentCore Memory recall returns nothing | Extraction is async — first call stores | Verify `actor_id` and `session_id` are consistent across invocations |
| Container crashes on AgentCore Runtime | Cold-start dep error or IAM gap | Tail `/aws/bedrock-agentcore/{agent_name}` log group |
| Bedrock cross-region call fails | Wrong region | Set `inference_profile_arn` (overrides `model_id`) |
| HITL workflow won't resume | DynamoDB checkpointer table missing | Confirm `dynamodb.tf` applied and IAM has `dynamodb:*` |
| Studio shows red Error in toolbar | Engine unreachable | Confirm engine running on port 8000; check `studio/src/api/engine.ts` base URL |
| Engine health dot stays red on the deployed Studio | CORS, sleeping HF Space, or wrong `VITE_API_BASE` | (a) Wake the Space by curling `/health`. (b) Verify `CORS_ORIGINS` matches the Cloudflare URL exactly. (c) Verify `studio/.env.production` matches the HF Space URL. Trigger a Cloudflare rebuild after changes. |
| Top-banner red box "1 graph-level error" | Validation error not anchored to a specific node (`MISSING_INPUT_NODE`, `MISSING_OUTPUT_NODE`, `CYCLE_DETECTED`, ...) | Add the missing input/output node, or remove the back-edge that creates the cycle. Banner dismisses on next Validate. |
| Git Push: `HTTP 401: bad token` | PAT expired or wrong scope | Regenerate token. GitHub: `Contents: read & write` on the repo. GitLab: `api` scope. |
| Git Push: `HTTP 404` on `/git/ref/heads/main` then succeeds | Target branch doesn't exist | Expected — engine auto-creates the branch off the default branch on first push. |
| Git Pull: `file 'project.json' not found at ref 'main'` | Path doesn't exist on that ref | Verify the file exists on the branch, or set the Path field to the correct location. |
| GitLab self-hosted: `network error` | Wrong base URL | Set the GitLab base URL field in the Push/Pull modal (e.g. `https://gitlab.example.com`). |
