---
title: JaguarData Platform
emoji: 🐆
colorFrom: red
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# JaguarData Platform

Data Contract Manager + Generative Agents Platform engine.

## Endpoints

- `GET /health` — health probe
- `POST /api/auth/login` — authenticate, get JWT
- `GET /api/auth/me` — current user info
- `POST /api/auth/logout` — client-side token discard
- `GET /api/dcm/dashboard` — stats + recent activity
- `GET /api/dcm/contracts` — list contracts
- `POST /api/dcm/contracts` — create contract
- `GET /api/dcm/contracts/{id}` — contract detail
- `GET /api/dcm/contracts/{id}/export` — export JSON/YAML/DDL
- `GET /api/dcm/requests` — list change requests
- `GET /api/dcm/requests/{id}` — request detail
- `POST /api/dcm/requests/{id}/approve` — approve request
- `POST /api/dcm/requests/{id}/reject` — reject request
- `POST /api/dcm/requests/{id}/comment` — add comment
- `POST /api/agents/validate` — validate agent graph
- `POST /api/agents/generate` — generate ZIP
- `POST /api/agents/git/push` — push to git
- `POST /api/agents/git/pull` — pull from git

## Configuration

Set as **Settings → Variables and secrets** in the Space:

| Variable | Purpose |
|---|---|
| `CORS_ORIGINS` | Comma-separated Studio origins |
| `JWT_SECRET` | Secret for JWT signing |
| `DCM_DATABASE_PATH` | SQLite database path (default: data/dcm.sqlite3) |

## Deploy

```bash
git remote add hf https://USER:TOKEN@huggingface.co/spaces/USER/jaguardata
git push hf $(git subtree split --prefix=backend HEAD):main --force
```

## Local run

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```
