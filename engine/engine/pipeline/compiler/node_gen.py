"""Generates agent/nodes/{node_id}.py for non-tool, non-KB nodes."""
from __future__ import annotations

from ..._types import CompiledFile
from ...models.graph import Edge, Node, Project
from .state_gen import _state_key


def generate_node(node: Node, project: Project, node_map: dict[str, Node]) -> CompiledFile | None:
    """Returns a CompiledFile for this node, or None if no node function needed."""
    dispatch = {
        "agent": _gen_agent,
        "multi_agent_coordinator": _gen_coordinator,
        "human_in_the_loop": _gen_hitl,
        "condition": _gen_condition,
        "loop": _gen_loop,
        "cache": _gen_cache,
        "logger": _gen_logger,
        "input": None,    # entry point — no node function; handled by graph entry
        "output": _gen_output,
        "kb_s3_vector": _gen_kb_s3_vector,
        "kb_bedrock": _gen_kb_bedrock,
        "retriever": _gen_retriever,
        "chunking": _gen_passthrough,
        "embedding": _gen_passthrough,
        "document_parser": _gen_passthrough,
        "s3_source": _gen_passthrough,
        "ingest_pipeline": _gen_passthrough,
        "mcp_client": _gen_passthrough,
        "mcp_server": None,  # deployed separately on AgentCore
    }
    generator = dispatch.get(node.type)
    if generator is None:
        return None
    return generator(node, project, node_map)


def _first_input_key(node: Node, edges: list[Edge]) -> str:
    """State key for this node's first input edge."""
    incoming = [e for e in edges if e.target_node_id == node.id]
    if incoming:
        e = incoming[0]
        return _state_key(e.source_node_id, e.source_port_id)
    return "messages"


def _gen_agent(node: Node, project: Project, node_map: dict[str, Node]) -> CompiledFile:
    model_id = node.config.get("model_id", "")
    profile_arn = node.config.get("inference_profile_arn", "")
    effective_model = profile_arn if profile_arn else model_id
    model_kwarg = "model_id" if not profile_arn else "model_id"

    system_prompt = node.config.get("system_prompt", "You are a helpful assistant.").replace('"', '\\"')
    temperature = node.config.get("temperature", 0.7)
    max_tokens = node.config.get("max_tokens", 4096)
    streaming = node.config.get("streaming", False)
    nid = node.id

    guardrails = node.config.get("guardrails", {})
    guardrail_config = ""
    if guardrails.get("guardrail_id"):
        gid = guardrails["guardrail_id"]
        gver = guardrails.get("guardrail_version", "DRAFT")
        guardrail_config = f', guardrails={{"guardrailIdentifier": "{gid}", "guardrailVersion": "{gver}"}}'

    response_key = _state_key(nid, "response")
    tool_calls_key = _state_key(nid, "tool_calls")

    content = f'''\
from langchain_aws import ChatBedrock
from langgraph.prebuilt import create_react_agent

from ..state import AgentState
from ..tools import get_tools_for_agent

_model = ChatBedrock(
    model_id="{effective_model}",
    model_kwargs={{"temperature": {temperature}, "max_tokens": {max_tokens}}}{guardrail_config},
    streaming={streaming},
)
_agent = create_react_agent(
    _model,
    get_tools_for_agent("{nid}"),
    state_modifier="{system_prompt}",
)


async def node_{nid}(state: AgentState) -> dict:
    result = await _agent.ainvoke({{"messages": state["messages"]}})
    messages = result["messages"]
    return {{
        "messages": messages,
        "{response_key}": messages[-1].content if messages else "",
        "{tool_calls_key}": [
            {{"name": m.name, "args": m.additional_kwargs}}
            for m in messages if hasattr(m, "name") and m.name
        ],
    }}
'''
    return CompiledFile(path=f"agent/nodes/{nid}.py", content=content)


def _gen_coordinator(node: Node, project: Project, node_map: dict[str, Node]) -> CompiledFile:
    model_id = node.config.get("model_id", "")
    system_prompt = node.config.get("system_prompt", "").replace('"', '\\"')
    max_iter = node.config.get("max_iterations", 10)
    workers: list[str] = node.config.get("workers", [])
    nid = node.id

    worker_imports = "\n".join(
        f"from .{wid} import node_{wid} as worker_{wid}" for wid in workers
    )
    worker_list = ", ".join(f"worker_{wid}" for wid in workers)

    content = f'''\
from langchain_aws import ChatBedrock
from langgraph_supervisor import create_supervisor

from ..state import AgentState
{worker_imports}

_model = ChatBedrock(model_id="{model_id}")

_supervisor = create_supervisor(
    [{worker_list}],
    model=_model,
    prompt="{system_prompt}",
    max_iterations={max_iter},
).compile()


async def node_{nid}(state: AgentState) -> dict:
    result = await _supervisor.ainvoke({{"messages": state["messages"]}})
    return {{"messages": result["messages"]}}
'''
    return CompiledFile(path=f"agent/nodes/{nid}.py", content=content)


def _gen_hitl(node: Node, project: Project, node_map: dict[str, Node]) -> CompiledFile:
    nid = node.id
    input_key = _first_input_key(node, project.edges)
    approved_key = _state_key(nid, "approved")
    rejected_key = _state_key(nid, "rejected")
    notification = node.config.get("notification", "email")
    target = node.config.get("notification_target", "")

    content = f'''\
from langgraph.types import interrupt

from ..state import AgentState


def node_{nid}(state: AgentState) -> dict:
    """Pauses execution and sends a notification to {target} via {notification}.

    Resumes when POST /callbacks/{{thread_id}} receives:
      {{"decision": "approve"|"reject", "reason": "string"}}
    """
    payload = state.get("{input_key}")
    decision: dict = interrupt(payload)

    if decision.get("decision") == "approve":
        return {{"{approved_key}": decision, "{rejected_key}": None}}
    return {{"{approved_key}": None, "{rejected_key}": decision.get("reason", "Rejected")}}
'''
    return CompiledFile(path=f"agent/nodes/{nid}.py", content=content)


def _gen_condition(node: Node, project: Project, node_map: dict[str, Node]) -> CompiledFile:
    nid = node.id
    expression = node.config.get("expression", "")
    lang = node.config.get("expression_language", "jmespath")
    input_key = _first_input_key(node, project.edges)

    if lang == "jmespath":
        eval_block = f'''\
    result = jmespath.search("{expression}", payload if isinstance(payload, dict) else {{"value": payload}})
    return "true" if result else "false"'''
        import_line = "import jmespath"
    else:  # cel
        eval_block = f'''\
    import cel as cel_lib
    prog = cel_lib.Environment().compile("{expression}")
    result = prog.evaluate({{"payload": payload}})
    return "true" if result else "false"'''
        import_line = ""

    content = f'''\
{import_line}

from ..state import AgentState


def node_{nid}(state: AgentState) -> str:
    """Routing function — returns branch name 'true' or 'false'."""
    payload = state.get("{input_key}")
{eval_block}
'''
    return CompiledFile(path=f"agent/nodes/{nid}.py", content=content)


def _gen_loop(node: Node, project: Project, node_map: dict[str, Node]) -> CompiledFile:
    nid = node.id
    input_key = _first_input_key(node, project.edges)
    results_key = _state_key(nid, "results")
    max_par = node.config.get("max_parallelism", 1)
    error_strategy = node.config.get("error_strategy", "fail_fast")

    # Fan-out: emits Send() per item; fan-in collector aggregates results
    content = f'''\
from typing import Annotated, List
import operator

from langgraph.types import Send

from ..state import AgentState


def node_{nid}_fanout(state: AgentState) -> list[Send]:
    """Fan-out: dispatches one Send per item in the input list."""
    items = state.get("{input_key}", [])
    return [Send("node_{nid}_process", {{"item": item}}) for item in items]


def node_{nid}_process(state: dict) -> dict:
    """Per-iteration processor — override with actual logic."""
    return {{"{results_key}": [state.get("item")]}}


def node_{nid}_fanin(state: AgentState) -> dict:
    """Fan-in: results are aggregated via Annotated[List, operator.add] in state."""
    return {{}}
'''
    return CompiledFile(path=f"agent/nodes/{nid}.py", content=content)


def _gen_cache(node: Node, project: Project, node_map: dict[str, Node]) -> CompiledFile:
    nid = node.id
    key_expr = node.config.get("key_expression", "payload")
    ttl = node.config.get("ttl_seconds", 3600)
    input_key = _first_input_key(node, project.edges)
    hit_key = _state_key(nid, "hit")
    miss_key = _state_key(nid, "miss")

    content = f'''\
import json
import time

import boto3
import jmespath

from ..config import CACHE_TABLE, AWS_REGION
from ..state import AgentState

_ddb = boto3.resource("dynamodb", region_name=AWS_REGION)
_table = _ddb.Table(CACHE_TABLE)


def node_{nid}(state: AgentState) -> dict:
    payload = state.get("{input_key}")
    cache_key = str(jmespath.search("{key_expr}", payload if isinstance(payload, dict) else {{"value": payload}}))

    item = _table.get_item(Key={{"pk": cache_key}}).get("Item")
    if item and item.get("expires_at", 0) > time.time():
        return {{"{hit_key}": json.loads(item["value"]), "{miss_key}": None}}

    _table.put_item(Item={{
        "pk": cache_key,
        "value": json.dumps(payload),
        "expires_at": int(time.time()) + {ttl},
    }})
    return {{"{hit_key}": None, "{miss_key}": payload}}
'''
    return CompiledFile(path=f"agent/nodes/{nid}.py", content=content)


def _gen_logger(node: Node, project: Project, node_map: dict[str, Node]) -> CompiledFile:
    nid = node.id
    level = node.config.get("level", "INFO").upper()
    msg_template = node.config.get("message_template", "").replace('"', '\\"')
    include_payload = node.config.get("include_payload", False)
    input_key = _first_input_key(node, project.edges)
    output_key = _state_key(nid, "payload")

    payload_log = f', "payload": payload' if include_payload else ""

    content = f'''\
import json
import logging

from ..state import AgentState

_log = logging.getLogger("{nid}")
logging.basicConfig(level=logging.{level})


def node_{nid}(state: AgentState) -> dict:
    payload = state.get("{input_key}")
    msg = "{msg_template}"
    if isinstance(payload, dict):
        try:
            msg = msg.format(**payload)
        except (KeyError, ValueError):
            pass
    _log.{level.lower()}(json.dumps({{
        "level": "{level}",
        "node_id": "{nid}",
        "message": msg{payload_log},
    }}))
    return {{"{output_key}": payload}}
'''
    return CompiledFile(path=f"agent/nodes/{nid}.py", content=content)


def _gen_output(node: Node, project: Project, node_map: dict[str, Node]) -> CompiledFile:
    nid = node.id
    input_key = _first_input_key(node, project.edges)

    content = f'''\
from ..state import AgentState


def node_{nid}(state: AgentState) -> dict:
    """Terminal node — writes final payload to state for the runner to read."""
    return {{"final_output": state.get("{input_key}")}}
'''
    return CompiledFile(path=f"agent/nodes/{nid}.py", content=content)


def _gen_kb_s3_vector(node: Node, project: Project, node_map: dict[str, Node]) -> CompiledFile:
    nid = node.id
    bucket = node.config.get("bucket", "")
    index_name = node.config.get("index_name", "")
    embedding_model = node.config.get("embedding_model_id", "amazon.titan-embed-text-v2:0")
    retriever_key = _state_key(nid, "retriever")

    content = f'''\
import boto3
from langchain_aws.embeddings import BedrockEmbeddings
from langchain_community.vectorstores import FAISS

from ..state import AgentState


def node_{nid}(state: AgentState) -> dict:
    """Builds a retriever backed by Amazon S3 Vectors (bucket: {bucket}, index: {index_name})."""
    embeddings = BedrockEmbeddings(model_id="{embedding_model}")
    # TODO: replace with S3 Vectors native client when langchain-aws adds support
    retriever = embeddings  # placeholder
    return {{"{retriever_key}": retriever}}
'''
    return CompiledFile(path=f"agent/nodes/{nid}.py", content=content)


def _gen_kb_bedrock(node: Node, project: Project, node_map: dict[str, Node]) -> CompiledFile:
    nid = node.id
    kb_id = node.config.get("knowledge_base_id", "")
    num_results = node.config.get("retrieval_config", {}).get("number_of_results", 5)
    search_type = node.config.get("retrieval_config", {}).get("search_type", "SEMANTIC")
    retriever_key = _state_key(nid, "retriever")

    content = f'''\
from langchain_aws import AmazonKnowledgeBasesRetriever

from ..state import AgentState


def node_{nid}(state: AgentState) -> dict:
    retriever = AmazonKnowledgeBasesRetriever(
        knowledge_base_id="{kb_id}",
        retrieval_config={{
            "vectorSearchConfiguration": {{
                "numberOfResults": {num_results},
                "searchType": "{search_type}",
            }}
        }},
    )
    return {{"{retriever_key}": retriever}}
'''
    return CompiledFile(path=f"agent/nodes/{nid}.py", content=content)


def _gen_retriever(node: Node, project: Project, node_map: dict[str, Node]) -> CompiledFile:
    nid = node.id
    top_k = node.config.get("top_k", 5)
    score_threshold = node.config.get("score_threshold")
    input_key = _first_input_key(node, project.edges)
    docs_key = _state_key(nid, "documents")

    threshold_filter = (
        f"\n    docs = [d for d in docs if d.metadata.get('score', 1.0) >= {score_threshold}]"
        if score_threshold is not None else ""
    )

    content = f'''\
from ..state import AgentState


async def node_{nid}(state: AgentState) -> dict:
    retriever = state.get("{input_key}")
    query = state.get("messages", [])
    query_text = query[-1].content if query else ""

    docs = await retriever.aget_relevant_documents(query_text, k={top_k}){threshold_filter}
    return {{"{docs_key}": [
        {{"content": d.page_content, "metadata": d.metadata}} for d in docs
    ]}}
'''
    return CompiledFile(path=f"agent/nodes/{nid}.py", content=content)


def _gen_passthrough(node: Node, project: Project, node_map: dict[str, Node]) -> CompiledFile:
    """Stub for nodes not yet fully implemented."""
    nid = node.id
    input_key = _first_input_key(node, project.edges)
    content = f'''\
from ..state import AgentState


def node_{nid}(state: AgentState) -> dict:
    """Passthrough stub for node type '{node.type}'."""
    return {{"{_state_key(nid, "output")}": state.get("{input_key}")}}
'''
    return CompiledFile(path=f"agent/nodes/{nid}.py", content=content)
