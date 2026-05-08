"""FastAPI application — Code Generation Engine."""
from __future__ import annotations

import io
import os
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .models.graph import Project
from .pipeline import bundler, observability
from .pipeline.compiler.compiler import compile_graph
from .pipeline.iac_generator import generate_iac
from .pipeline.local_scaffold import generate_local_scaffold
from .pipeline.test_generator import generate_tests
from .pipeline.validator import ValidationError, validate

app = FastAPI(
    title="Generative Agents Platform — Engine",
    version="0.1.0",
    description="Code generation engine that converts visual agent graphs into deployable ZIPs.",
)


def _cors_origins() -> list[str]:
    """Comma-separated list of allowed origins. Defaults to local Vite ports.

    Set CORS_ORIGINS at deploy time, e.g.:
        CORS_ORIGINS=https://agents-studio.pages.dev,https://studio.example.com
    Use '*' to allow any origin (do not combine with credentials).
    """
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    if not raw:
        return ["http://localhost:5173", "http://localhost:4173"]
    return [o.strip() for o in raw.split(",") if o.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.post("/validate")
def validate_graph(project: Project) -> dict:
    """Validate a graph DAG without generating code.

    Returns validation errors as structured JSON suitable for Studio inline markers.
    """
    result = validate(project)
    return {
        "valid": result.valid,
        "errors": [e.to_dict() for e in result.errors],
    }


@app.post("/generate")
def generate(project: Project) -> StreamingResponse:
    """Validate the graph and generate a deployable ZIP bundle.

    Returns a ZIP file download containing Python agent code, Terraform IaC,
    pytest tests, local simulation scripts, and project.json for re-import.
    """
    # Phase 1 — Validate
    validation = validate(project)
    if not validation.valid:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Graph validation failed",
                "errors": [e.to_dict() for e in validation.errors],
            },
        )

    # Phase 2 — Compile graph → Python agent package
    artifacts = compile_graph(project, validation.sorted_nodes)

    # Phase 3 — IaC
    artifacts.merge(generate_iac(project, validation.sorted_nodes))

    # Phase 4 — Tests
    artifacts.merge(generate_tests(project))

    # Phase 5 — Local scaffold (Dockerfile, pyproject.toml, local/ scripts, .env.example)
    artifacts.merge(generate_local_scaffold(project))

    # Phase 6 — Observability injection
    observability.inject_observability(project, artifacts)

    # Phase 7 — ZIP bundle
    zip_bytes = bundler.bundle(project, artifacts)

    agent_name = project.name.lower().replace(" ", "-")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    filename = f"agent-{agent_name}-{timestamp}.zip"

    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# Lambda adapter for AWS deployment
try:
    from mangum import Mangum
    handler = Mangum(app, lifespan="off")
except ImportError:
    handler = None  # running locally via uvicorn
