"""Generates agent/runner.py — Lambda handler and CLI entrypoint."""
from __future__ import annotations

from ..._types import CompiledFile
from ...models.graph import Node, Project


def generate_runner(project: Project) -> CompiledFile:
    has_streaming = any(
        n.config.get("streaming", False)
        for n in project.nodes if n.type == "agent"
    )
    has_hitl = project.has_node_type("human_in_the_loop")

    streaming_handler = ""
    if has_streaming:
        streaming_handler = '''

async def streaming_lambda_handler(event: dict, context) -> None:
    """Streaming handler — requires Lambda response streaming + WebSocket/chunked API Gateway.

    Terraform must set: FunctionResponseTypes = ["STREAMRESPONSE"]
    """
    body = _parse_body(event)
    thread_id = body.get("thread_id", str(uuid.uuid4()))
    config = {"configurable": {"thread_id": thread_id}}
    state = _build_initial_state(body)

    async for chunk in graph.astream(state, config=config, stream_mode="messages"):
        message, _ = chunk
        if hasattr(message, "content") and message.content:
            yield json.dumps({"token": message.content, "thread_id": thread_id}).encode() + b"\\n"
'''

    content = f'''\
from __future__ import annotations

import json
import uuid

from langchain_core.messages import HumanMessage

from .graph import graph
from .state import AgentState


def _parse_body(event: dict) -> dict:
    body = event.get("body", {{}})
    if isinstance(body, str):
        body = json.loads(body)
    return body or {{}}


def _build_initial_state(body: dict) -> AgentState:
    message = body.get("message", "")
    return AgentState(
        messages=[HumanMessage(content=message)] if message else [],
        **{{k: v for k, v in body.items() if k not in ("message", "thread_id")}},
    )


def lambda_handler(event: dict, context) -> dict:
    body = _parse_body(event)
    thread_id = body.get("thread_id", str(uuid.uuid4()))
    config = {{"configurable": {{"thread_id": thread_id}}}}
    state = _build_initial_state(body)

    result = graph.invoke(state, config=config)

    final_output = result.get("final_output")
    if final_output is None:
        # Fall back: last message content
        msgs = result.get("messages", [])
        final_output = msgs[-1].content if msgs else ""

    return {{
        "statusCode": 200,
        "headers": {{"Content-Type": "application/json"}},
        "body": json.dumps({{"response": final_output, "thread_id": thread_id}}),
    }}
{streaming_handler}

if __name__ == "__main__":
    import sys

    payload = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {{}}
    fake_event = {{"body": json.dumps(payload)}}
    result = lambda_handler(fake_event, None)
    print(result["body"])
'''
    return CompiledFile(path="agent/runner.py", content=content)
