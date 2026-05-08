---
title: Agents Platform Engine
emoji: 🤖
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Agents Platform — Engine

Code generation engine for the Generative Agents Platform. Converts a
graph DAG (designed in the Studio) into a deployable ZIP bundle (Python
+ Terraform + Docker) targeting Amazon Bedrock AgentCore.

## Endpoints

- `GET /health` — health probe
- `POST /validate` — validate a Project JSON
- `POST /generate` — validate + compile + return ZIP

## Configuration

Set as **Settings → Variables and secrets** in the Space:

| Variable | Purpose |
|---|---|
| `CORS_ORIGINS` | Comma-separated list of Studio origins, e.g. `https://agents-studio.<account>.workers.dev` |

## Local run

```bash
cd engine
uv sync
uv run uvicorn engine.main:app --reload --port 8000
```

## Tests

`uv run pytest tests/ -v` — 43 tests covering validator, compiler, IaC,
runner, observability, and end-to-end ZIP bundling.

## License

MIT.
