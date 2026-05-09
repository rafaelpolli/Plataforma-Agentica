# JaguarData Platform

Data Contract Manager + Generative AI Agents Platform. Self-hosted monorepo
with a React SPA frontend and a Python FastAPI backend.

## Overview

Two products in one deployment:

| Product | Purpose | Users |
|---------|---------|-------|
| **Data Contract Manager (DCM)** | Catalog, manage, and govern data contracts with change-request workflows | Data producers, consumers, stewards |
| **Agents Studio** | Drag-and-drop designer for generative AI agents that compile to deployable ZIPs (Python + Terraform + Docker) on Amazon Bedrock AgentCore | ML engineers, platform teams |

Deployed as:
- **Backend**: HuggingFace Spaces (Docker SDK, Python FastAPI)
- **Frontend**: Cloudflare Workers Assets (React SPA, static deploy)

## Architecture

```
Browser ──► Cloudflare Workers (SPA)
                │
                │ HTTPS (JWT Bearer)
                ▼
         HuggingFace Space (FastAPI)
         ┌──────────────────────────────┐
         │  /api/auth/*   — JWT auth    │
         │  /api/dcm/*    — DCM REST    │
         │  /api/agents/* — Code-gen    │
         │  /health        — probe      │
         └──────────────────────────────┘
```

**Auth flow**: Login → JWT issued → stored in browser localStorage → sent as `Authorization: Bearer <token>` on every API call. Stateless — no server-side sessions.

## Directory Structure

```
Plataforma-Agentica/
├── backend/                        # HuggingFace Spaces deploy
│   ├── Dockerfile                  # python:3.12-slim, port 7860
│   ├── README.md                   # HF Spaces YAML frontmatter
│   ├── pyproject.toml              # uv-managed dependencies
│   ├── requirements.txt            # pip fallback
│   └── app/
│       ├── main.py                 # FastAPI root — mounts all routers
│       ├── auth.py                 # JWT issue/verify, demo users
│       ├── dcm/
│       │   ├── router.py           # Contracts + Requests REST endpoints
│       │   ├── models.py           # Pydantic models
│       │   ├── storage.py          # SQLite CRUD
│       │   └── mock_data.py        # Seed data
│       └── engine/                 # Agent code generation engine
│           ├── main.py             # Engine FastAPI sub-app
│           ├── integrations/git.py # GitHub/GitLab push/pull
│           ├── models/graph.py     # Graph data model
│           └── pipeline/           # 7-phase code generation
├── frontend/                       # Cloudflare Workers deploy
│   ├── src/
│   │   ├── App.tsx                 # React Router — all routes
│   │   ├── main.tsx                # Entry point
│   │   ├── api/                    # API clients (auth, dcm, engine, git)
│   │   ├── store/                  # Zustand stores (auth, graph)
│   │   ├── types/                  # TypeScript types (graph, dcm)
│   │   ├── pages/
│   │   │   ├── Login/              # Login page
│   │   │   ├── Dashboard/          # DCM dashboard
│   │   │   ├── Contracts/          # List, Detail, Create (wizard)
│   │   │   ├── Requests/           # List, Detail (diff, comments)
│   │   │   └── Studio/             # Agent Studio (canvas + panels)
│   │   ├── components/
│   │   │   ├── Layout.tsx          # Navbar, role switcher, toasts
│   │   │   ├── AuthGuard.tsx       # Route protection
│   │   │   └── shared/             # Card, Badge, Table, Tabs, Modal
│   │   └── nodes/                  # Agent node catalog (27 types)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts              # Vite proxy /api → localhost:8000
│   ├── wrangler.toml               # Cloudflare Workers Assets config
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── .env.production             # VITE_API_BASE for production build
├── docs/
│   ├── user-guide.md               # Agent Studio in-depth guide
│   └── agentcore-gaps.md           # AgentCore implementation record
├── generative-agents-platform-spec.md
└── CLAUDE.md                       # AI assistant guidance
```

## Quick Start (Local Development)

### Prerequisites

- Python 3.12+
- Node.js 18+
- uv (Python package manager): `pip install uv`

### 1. Start the backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Backend at `http://localhost:8000`. Verify:

```bash
curl http://localhost:8000/health
# {"status":"ok","timestamp":"..."}

curl http://localhost:8000/api/health
# {"status":"ok","timestamp":"..."}
```

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend at `http://localhost:5173`. Vite proxies `/api/*` → `localhost:8000`.

### 3. Log in

Open `http://localhost:5173`. Login with demo credentials (see [Demo Users](#demo-users)).

### 4. Run backend tests

```bash
cd backend
uv run pytest tests/ -v
```

### 5. Build frontend for production

```bash
cd frontend
npm run build
# Output: dist/ (index.html + hashed assets)
```

## Backend

### API Endpoints

#### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | No | Login with username/password, returns JWT |
| `GET` | `/api/auth/me` | JWT | Validate token, return user info |
| `POST` | `/api/auth/logout` | No | Client-side token discard |

#### DCM (`/api/dcm`) — all require JWT

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dcm/dashboard` | Stats + recent activity |
| `GET` | `/api/dcm/contracts?status=&layer=&q=` | List contracts (filterable) |
| `GET` | `/api/dcm/contracts/{id}` | Contract detail |
| `POST` | `/api/dcm/contracts` | Create contract |
| `GET` | `/api/dcm/contracts/{id}/export?format=json|yaml|ddl` | Export contract |
| `GET` | `/api/dcm/requests?status=` | List change requests |
| `GET` | `/api/dcm/requests/{id}` | Request detail |
| `POST` | `/api/dcm/requests/{id}/approve` | Approve request |
| `POST` | `/api/dcm/requests/{id}/reject` | Reject request |
| `POST` | `/api/dcm/requests/{id}/comment` | Add comment |

#### Agents Engine (`/api/agents`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/agents/health` | No | Engine health probe |
| `POST` | `/api/agents/validate` | No | Validate agent graph |
| `POST` | `/api/agents/generate` | No | Generate ZIP bundle |
| `POST` | `/api/agents/git/push` | No | Push generated repo to GitHub/GitLab |
| `POST` | `/api/agents/git/pull` | No | Pull project.json from git |

#### System

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Platform health probe |
| `GET` | `/api/health` | Platform health probe (same, under /api) |

### Configuration (Environment Variables)

Set on the HF Space at **Settings → Variables and secrets**:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CORS_ORIGINS` | Yes | `http://localhost:5173,http://localhost:4173` | Comma-separated frontend origins |
| `JWT_SECRET` | Yes | `dev-secret` | Secret key for JWT signing |
| `DCM_DATABASE_PATH` | No | `data/dcm.sqlite3` | SQLite database path |

### Demo Users

Three hardcoded users for development/demo:

| Username | Password | Role | Description |
|----------|----------|------|-------------|
| `ana` | `ana` | creator | Can create contracts and submit change requests |
| `carlos` | `carlos` | admin | Can approve/reject requests, full access |
| `beatriz` | `beatriz` | viewer | Read-only access |

## Frontend

### Pages

| Route | Page | Description |
|-------|------|-------------|
| `/login` | LoginPage | Canvas animation + login form |
| `/` | DashboardPage | Metrics cards, layer chart, recent activity |
| `/contracts` | ContractsListPage | Filterable table of contracts |
| `/contracts/new` | ContractCreatePage | 3-step creation wizard |
| `/contracts/:id` | ContractDetailPage | Tabs: Overview, Schema, Location, History, Requests |
| `/requests` | RequestsListPage | Filterable change request list |
| `/requests/:id` | RequestDetailPage | Diff viewer, comment thread, approve/reject |
| `/agents` | StudioPage | Agent Studio: node panel + canvas + config panel |

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | React 18, TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 |
| Routing | React Router v6 |
| Canvas | React Flow (@xyflow/react) |
| State | Zustand |
| Code editor | Monaco Editor (@monaco-editor/react) |
| ZIP handling | JSZip |
| Deployment | Cloudflare Workers Assets (wrangler) |

## Deployment

### HuggingFace Spaces (Backend)

**First-time setup:**

1. Create a Space at https://huggingface.co/new-space:
   - SDK: **Docker → Blank**
   - Space name: `jaguardata`
   - License: MIT

2. Generate a write token at https://huggingface.co/settings/tokens (scope: `write`).

3. Add the HF remote and push:

```bash
cd Plataforma-Agentica
git remote add hf https://USER:TOKEN@huggingface.co/spaces/USER/jaguardata
git push hf $(git subtree split --prefix=backend HEAD):main --force
```

4. Set secrets on the Space (**Settings → Variables and secrets**):

| Name | Value |
|------|-------|
| `JWT_SECRET` | A strong random string |
| `CORS_ORIGINS` | Your Cloudflare Workers URL (e.g., `https://jaguardata.YOUR-ACCOUNT.workers.dev`) |

5. Wait for the Docker build (~3-5 min first time). The Space badge turns **Running**.

6. Verify:
   ```bash
   curl https://USER-jaguardata.hf.space/health
   ```

### Cloudflare Workers (Frontend)

**First-time setup:**

1. Authenticate:
   ```bash
   cd frontend
   npx wrangler login
   ```

2. Edit `.env.production` to point to your HF Space:
   ```
   VITE_API_BASE=https://YOUR-USER-jaguardata.hf.space/api
   ```

3. Build and deploy:
   ```bash
   npm run build
   npx wrangler deploy
   ```

4. Frontend publishes to `https://jaguardata.YOUR-ACCOUNT.workers.dev`.

5. Update the HF Space `CORS_ORIGINS` to include the Workers URL.

### Custom Domain (optional)

**Cloudflare Workers**: Workers & Pages → jaguardata → Settings → Custom Domains.
Requires DNS managed on Cloudflare.

## Updating Deployed Instances

### Update Backend (HF Spaces)

Make changes to `backend/`, commit, then push the subtree:

```bash
cd Plataforma-Agentica

# Stage and commit your changes
git add backend/
git commit -m "backend: describe changes"

# Push the backend subtree to HF
git push hf $(git subtree split --prefix=backend HEAD):main --force
```

The Space auto-rebuilds on push. ~2-3 min for incremental builds.

**Note**: The `--force` flag is required because `git subtree split` creates a new commit hash each time, even if content hasn't changed — HF rejects a non-force push because the new commit doesn't fast-forward from the previous one.

### Update Frontend (Cloudflare Workers)

Make changes to `frontend/`, then rebuild and deploy:

```bash
cd frontend

# Rebuild (reads .env.production for VITE_API_BASE)
npm run build

# Deploy
npx wrangler deploy
```

~20-30 seconds. Zero-downtime — Cloudflare serves the previous version until the new one is uploaded.

### Update Both Together

```bash
cd Plataforma-Agentica

# Commit all changes
git add -A
git commit -m "release: describe changes"

# Deploy backend
git push hf $(git subtree split --prefix=backend HEAD):main --force

# Deploy frontend
cd frontend
npm run build && npx wrangler deploy
```

### Checking Deployed Versions

```bash
# Backend — check current git ref on HF Space
curl -s https://USER-jaguardata.hf.space/health

# Frontend — check Cloudflare version
cd frontend
npx wrangler versions list
```

## HF Spaces Caveats

- **Free tier sleep**: After ~48 h idle, the Space sleeps. First request wakes it (~10-30s cold start). The frontend health dot shows red until it wakes.
- **Ephemeral storage**: SQLite data is lost on Space restart (free tier). Seed data reloads from `mock_data.py` on startup.
- **Public source**: Free tier Spaces are public. Upgrade to Pro ($9/mo) for private Spaces.
- **Build cache**: Docker layers are cached. Dependency changes trigger a full rebuild (~3-5 min); code-only changes are fast (~1-2 min).

## Cloudflare Workers Caveats

- **SPA routing**: `wrangler.toml` must include `not_found_handling = "single-page-application"` so React Router handles paths like `/agents` directly.
- **No runtime env vars**: Cloudflare Workers Assets doesn't support runtime variables. `VITE_API_BASE` is **baked at build time** from `.env.production`. After changing the HF Space URL, you must rebuild and redeploy.
- **Free tier**: 100k requests/day, generous bandwidth.

## Design Tokens

| Token | Value |
|-------|-------|
| Brand orange | `#FF6200` |
| Brand light | `#FFB347` |
| Brand dark | `#E05200` |
| Surface | `#FAFAF8` |
| Font (headings) | Inter |
| Font (mono) | IBM Plex Mono |

## Key Technical Decisions

1. **JWT over cookies**: CORS with cookies across domains needs SameSite=None + Secure. JWT Bearer tokens in Authorization header are simpler and work with any CORS origin.

2. **SQLite on HF Spaces**: Free tier storage is ephemeral. Data seeds from `mock_data.py` on first startup. For persistent storage, mount an external DB or use HF paid tier.

3. **Engine as sub-application**: Mounted at `/api/agents` inside the root FastAPI app. CORS handled centrally.

4. **Single Vite build**: DCM pages + Agent Studio share one bundle. Monaco Editor chunks are code-split automatically.

5. **Backend subtree push**: Only the `backend/` directory is pushed to HF Spaces. The monorepo stays clean with frontend code separate.

6. **Frontend `.env.production` committed**: The engine URL is public (no secret). Vite inlines it at build time. Cloudflare Workers Assets blocks runtime variables.

## Generated Agent Stack (Agents Studio)

For documentation on the agent generation platform (canvas, node types, ZIP structure, generated Terraform, AgentCore deployment), see:

- [docs/user-guide.md](docs/user-guide.md) — full Agent Studio guide
- [docs/agentcore-gaps.md](docs/agentcore-gaps.md) — AgentCore implementation coverage
- [generative-agents-platform-spec.md](generative-agents-platform-spec.md) — original platform spec

## License

MIT — see LICENSE file in the repository.
