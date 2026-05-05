"""Phase 5: Local Runner Scaffold — generates local/ scripts and Dockerfile."""
from __future__ import annotations

from .._types import CompiledArtifacts, CompiledFile
from ..models.graph import Node, Project


def generate_local_scaffold(project: Project) -> CompiledArtifacts:
    artifacts = CompiledArtifacts()
    agent_name = project.name.lower().replace(" ", "-")

    artifacts.add(_gen_run_agent(agent_name))
    artifacts.add(_gen_run_workflow(agent_name))
    artifacts.add(_gen_mock_tools(project))
    artifacts.add(_gen_dockerfile(agent_name))
    artifacts.add(_gen_pyproject(agent_name))
    artifacts.add(_gen_env_example(project))

    return artifacts


def _gen_run_agent(agent_name: str) -> CompiledFile:
    content = f'''\
#!/usr/bin/env python
"""Local agent runner for {agent_name}.

Usage:
  uv run python local/run_agent.py --input '{{"message": "Hello"}}' [--mock-tools]
  AWS_PROFILE=dev uv run python local/run_agent.py --input '{{"message": "Hello"}}'
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="JSON input payload")
    parser.add_argument("--mock-tools", action="store_true", help="Replace tool calls with mocks")
    args = parser.parse_args()

    payload = json.loads(args.input)

    if args.mock_tools:
        from local.mock_tools import patch_tools
        patch_tools()

    from agent.runner import lambda_handler
    result = lambda_handler({{"body": json.dumps(payload)}}, None)
    print(json.dumps(json.loads(result["body"]), indent=2))


if __name__ == "__main__":
    main()
'''
    return CompiledFile(path="local/run_agent.py", content=content)


def _gen_run_workflow(agent_name: str) -> CompiledFile:
    content = f'''\
#!/usr/bin/env python
"""Local workflow runner for {agent_name}.

Usage:
  uv run python local/run_workflow.py --input-file local/sample_input.json
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-file", required=True)
    args = parser.parse_args()

    with open(args.input_file) as f:
        payload = json.load(f)

    from agent.runner import lambda_handler
    result = lambda_handler({{"body": json.dumps(payload)}}, None)
    print(json.dumps(json.loads(result["body"]), indent=2))


if __name__ == "__main__":
    main()
'''
    return CompiledFile(path="local/run_workflow.py", content=content)


def _gen_mock_tools(project: Project) -> CompiledFile:
    tool_mocks = []
    for n in project.nodes:
        if n.is_tool():
            fn = n.config.get("name", f"tool_{n.id}").replace("-", "_").lower()
            tool_mocks.append(
                f'    monkeypatch_module("agent.tools.{n.id}", "{fn}", lambda **kw: {{"mocked": True}})'
            )

    mock_body = "\n".join(tool_mocks) if tool_mocks else "    pass"

    content = f'''\
"""Mock tool implementations for local testing without AWS."""
import importlib
from unittest.mock import MagicMock


def monkeypatch_module(module_path: str, fn_name: str, replacement):
    try:
        mod = importlib.import_module(module_path)
        mock = MagicMock(side_effect=replacement)
        mock.invoke = replacement
        setattr(mod, fn_name, mock)
    except ImportError:
        pass


def patch_tools():
{mock_body}
'''
    return CompiledFile(path="local/mock_tools.py", content=content)


def _gen_dockerfile(agent_name: str) -> CompiledFile:
    content = '''\
FROM python:3.12-slim AS builder

WORKDIR /build
RUN pip install uv
COPY pyproject.toml .
RUN uv pip install --system --no-cache .

FROM python:3.12-slim

WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY . .

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "agent.runner"]
'''
    return CompiledFile(path="Dockerfile", content=content)


def _gen_pyproject(agent_name: str) -> CompiledFile:
    content = f'''\
[project]
name = "{agent_name}"
version = "0.1.0"
requires-python = ">=3.12"

dependencies = [
    "langgraph>=0.2",
    "langgraph-supervisor>=0.0.5",
    "langchain>=0.3",
    "langchain-aws>=0.2",
    "langchain-community>=0.3",
    "boto3>=1.35",
    # agentcore-sdk package name TBD — see project open items
    # "agentcore-sdk>=0.1",
    "fastapi>=0.115",
    "uvicorn>=0.30",
    "langsmith>=0.1",
    "pydantic>=2.0",
    "jmespath>=1.0",
    "cel-python>=0.1.5",
    "httpx>=0.27",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "moto[all]>=5.0",
    "responses>=0.25",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["agent", "tools"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
'''
    return CompiledFile(path="pyproject.toml", content=content)


def _gen_env_example(project: Project) -> CompiledFile:
    agent_name = project.name.lower().replace(" ", "-")
    content = f'''\
# Copy to .env and fill in real values before running locally.
# Never commit .env — this file contains only placeholder values.

AWS_REGION=us-east-1
AWS_PROFILE=your-dev-profile
AGENT_NAME={agent_name}
CHECKPOINTER_TABLE={agent_name}-sessions
CACHE_TABLE={agent_name}-cache

# LangSmith (optional — disable by removing LANGCHAIN_TRACING_V2)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls__your_key_here
LANGCHAIN_PROJECT={agent_name}
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
'''
    return CompiledFile(path=".env.example", content=content)
