"""Tests for Phase 2: Graph Compiler."""
from __future__ import annotations

import pytest

from engine.pipeline.compiler.compiler import compile_graph
from engine.pipeline.compiler.state_gen import collect_state_fields
from engine.pipeline.validator import validate


def test_compile_minimal_project_produces_agent_files(minimal_project):
    result = validate(minimal_project)
    assert result.valid
    artifacts = compile_graph(minimal_project, result.sorted_nodes)

    expected_paths = {
        "agent/__init__.py",
        "agent/state.py",
        "agent/config.py",
        "agent/graph.py",
        "agent/runner.py",
        "agent/nodes/__init__.py",
        "agent/tools/__init__.py",
    }
    assert expected_paths.issubset(artifacts.files.keys())


def test_state_has_messages_field_for_agent_graph(minimal_project):
    node_map = minimal_project.node_map()
    fields = collect_state_fields(minimal_project, node_map)
    assert "messages" in fields
    assert "Annotated" in fields["messages"]


def test_agent_node_file_generated(minimal_project):
    result = validate(minimal_project)
    artifacts = compile_graph(minimal_project, result.sorted_nodes)
    assert "agent/nodes/n_agent.py" in artifacts.files
    content = artifacts.files["agent/nodes/n_agent.py"]
    assert "ChatBedrock" in content
    assert "create_react_agent" in content
    assert "anthropic.claude-3-5-sonnet-20241022-v2:0" in content


def test_condition_node_not_added_as_graph_node(project_with_condition):
    result = validate(project_with_condition)
    artifacts = compile_graph(project_with_condition, result.sorted_nodes)
    graph_py = artifacts.files["agent/graph.py"]
    # condition node n_cond must NOT appear as add_node but MUST appear as routing fn
    assert 'add_node("node_n_cond"' not in graph_py
    assert "node_n_cond" in graph_py  # used as routing function
    assert "add_conditional_edges" in graph_py


def test_hitl_graph_gets_dynamodb_checkpointer(minimal_project):
    from tests.conftest import make_edge, make_node, make_port
    from engine.models.graph import Project

    hitl = make_node("human_in_the_loop", "n_hitl", config={
        "notification": "email",
        "notification_target": "reviewer@example.com",
    }, inputs=[make_port("payload", "Payload", "any", required=True)])

    p = Project(
        name="hitl-agent",
        nodes=minimal_project.nodes + [hitl],
        edges=minimal_project.edges + [
            make_edge("n_agent", "response", "n_hitl", "payload"),
        ],
    )
    result = validate(p)
    artifacts = compile_graph(p, result.sorted_nodes)
    graph_py = artifacts.files["agent/graph.py"]
    assert "DynamoDBSaver" in graph_py
    assert "checkpointer" in graph_py


def test_no_hitl_graph_has_no_checkpointer(minimal_project):
    result = validate(minimal_project)
    artifacts = compile_graph(minimal_project, result.sorted_nodes)
    graph_py = artifacts.files["agent/graph.py"]
    assert "DynamoDBSaver" not in graph_py


def test_runner_has_lambda_handler(minimal_project):
    result = validate(minimal_project)
    artifacts = compile_graph(minimal_project, result.sorted_nodes)
    runner = artifacts.files["agent/runner.py"]
    assert "def lambda_handler" in runner
    assert "graph.invoke" in runner


def test_streaming_runner_generated_for_streaming_agent(minimal_project):
    # Enable streaming on the agent node
    for n in minimal_project.nodes:
        if n.type == "agent":
            n.config["streaming"] = True
    result = validate(minimal_project)
    artifacts = compile_graph(minimal_project, result.sorted_nodes)
    runner = artifacts.files["agent/runner.py"]
    assert "streaming_lambda_handler" in runner
    assert "astream" in runner


def test_config_has_lazy_secret_fetch(minimal_project):
    result = validate(minimal_project)
    artifacts = compile_graph(minimal_project, result.sorted_nodes)
    config = artifacts.files["agent/config.py"]
    assert "lru_cache" in config
    assert "get_secret" in config
    assert "secretsmanager" in config


def test_inference_profile_arn_takes_precedence(minimal_project):
    for n in minimal_project.nodes:
        if n.type == "agent":
            n.config["inference_profile_arn"] = "arn:aws:bedrock:us-east-1:123:inference-profile/x"
    result = validate(minimal_project)
    artifacts = compile_graph(minimal_project, result.sorted_nodes)
    agent_node_py = artifacts.files["agent/nodes/n_agent.py"]
    assert "arn:aws:bedrock:us-east-1:123:inference-profile/x" in agent_node_py
