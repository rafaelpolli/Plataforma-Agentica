"""Phase 6: Observability Injector — patches LangSmith + CloudWatch into generated code."""
from __future__ import annotations

from .._types import CompiledArtifacts, CompiledFile
from ..models.graph import Project

_LANGSMITH_BLOCK = '''\
import os

# LangSmith tracing — set LANGCHAIN_TRACING_V2=true and LANGCHAIN_API_KEY to enable
if os.environ.get("LANGCHAIN_TRACING_V2", "").lower() == "true":
    os.environ.setdefault("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com")
    os.environ.setdefault("LANGCHAIN_PROJECT", os.environ.get("AGENT_NAME", "agent"))
'''

_CLOUDWATCH_BLOCK = '''\
import json
import logging

import boto3

_cw = boto3.client("cloudwatch", region_name=os.environ.get("AWS_REGION", "us-east-1"))
_AGENT_NAME = os.environ.get("AGENT_NAME", "agent")


def emit_metric(name: str, value: float, unit: str = "Milliseconds") -> None:
    try:
        _cw.put_metric_data(
            Namespace=f"AgentsPlatform/{_AGENT_NAME}",
            MetricData=[{
                "MetricName": name,
                "Value": value,
                "Unit": unit,
                "Dimensions": [{"Name": "AgentName", "Value": _AGENT_NAME}],
            }],
        )
    except Exception:
        pass  # Never let observability break the agent
'''


def inject_observability(project: Project, artifacts: CompiledArtifacts) -> CompiledArtifacts:
    """
    Injects observability bootstrapping into agent/runner.py and adds
    agent/observability.py with CloudWatch helpers.
    """
    # Add observability module
    content = _LANGSMITH_BLOCK + "\n" + _CLOUDWATCH_BLOCK
    artifacts.add(CompiledFile(path="agent/observability.py", content=content))

    # Patch runner.py to import observability at startup
    runner_path = "agent/runner.py"
    if runner_path in artifacts.files:
        existing = artifacts.files[runner_path]
        # Prepend the import after the first line
        injected = "import agent.observability  # noqa: F401 — side-effect import\n" + existing
        artifacts.files[runner_path] = injected

    return artifacts
