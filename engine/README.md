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
- `POST /git/push` — run pipeline + atomic commit to GitHub or GitLab
- `POST /git/pull` — read `project.json` from GitHub or GitLab

## Configuration

Set as **Settings → Variables and secrets** in the Space:

| Variable | Purpose |
|---|---|
| `CORS_ORIGINS` | Comma-separated list of Studio origins, e.g. `https://agents-studio.<account>.workers.dev` |

## Deploy this Space from the monorepo

```bash
# one-time
git remote add hf https://USER:TOKEN@huggingface.co/spaces/USER/agents-engine

# first push (overwrites HF template commit)
git push hf $(git subtree split --prefix=engine HEAD):main --force

# subsequent pushes (fast-forward)
git push hf $(git subtree split --prefix=engine HEAD):main
```

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
