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

## Generated Artifact Tech Stack

Generated agents use:
- **Framework:** LangGraph + LangChain (ReAct pattern)
- **LLM:** Amazon Bedrock (Claude, Titan) — Bedrock-only for v1
- **MCP:** agentcore-sdk (MCP Server + Client)
- **HTTP:** FastAPI + uvicorn
- **Dependency manager:** uv
- **Testing:** pytest + moto (AWS mocks) + responses (HTTP mocks)
- **Container:** Docker `python:3.12-slim`
- **Observability:** LangSmith traces + CloudWatch structured JSON logs

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

## Node Types (Canvas)

30+ node types. Key ones:

- **Core:** `input`, `output`, `agent`, `multi_agent_coordinator`, `human_in_the_loop`
- **Tools:** `tool_custom` (Python Lambda), `tool_athena` (SQL), `tool_s3`, `tool_http`, `tool_bedrock`
- **Knowledge:** `kb_s3_vector`, `kb_bedrock`, `chunking`, `embedding`, `retriever`
- **Data ingestion:** `s3_source`, `document_parser`, `ingest_pipeline`
- **Integration:** `mcp_server`, `mcp_client`
- **Flow control:** `condition`, `loop`, `cache`, `logger`

## project.json Versioning

Generated ZIPs include `project.json` for round-trip import. Schema uses semantic versioning with declarative migrators. Platform must support re-importing the last 2 major versions. Never break the migration chain — add migrators, don't modify existing ones.

## Security Constraints

- IAM roles are per-agent, least-privilege — no shared execution roles across agents
- All credentials via IAM roles + Secrets Manager — no hardcoded values anywhere
- Bedrock Guardrails are optional but the architecture must support them
- TLS 1.2+ in transit, SSE-S3/SSE-KMS at rest

## Key Design Decisions (from spec)

- **Single-tenant only** — no multi-workspace, no RBAC in v1
- **Bedrock-only LLM** in v1 — architecture must be provider-agnostic for future extensibility
- **Customer owns generated code** — no license restrictions on ZIP contents
- **Self-hosted** — zero external SaaS runtime dependencies after install
