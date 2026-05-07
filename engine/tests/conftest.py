"""Shared test fixtures for the engine test suite."""
from __future__ import annotations

import pytest

from engine.models.graph import (
    Canvas,
    Edge,
    Node,
    NodePorts,
    Port,
    Position,
    Project,
)


def make_node(node_type: str, node_id: str = None, config: dict = None, **port_kwargs) -> Node:
    nid = node_id or f"node_{node_type}"
    return Node(
        id=nid,
        type=node_type,
        label=node_type.replace("_", " ").title(),
        position=Position(x=0, y=0),
        config=config or {},
        ports=NodePorts(
            inputs=port_kwargs.get("inputs", []),
            outputs=port_kwargs.get("outputs", []),
        ),
    )


def make_port(port_id: str, name: str, data_type: str = "any", required: bool = False) -> Port:
    return Port(id=port_id, name=name, data_type=data_type, required=required)


def make_edge(source_node_id: str, source_port_id: str, target_node_id: str, target_port_id: str, data_type: str = "any") -> Edge:
    return Edge(
        source_node_id=source_node_id,
        source_port_id=source_port_id,
        target_node_id=target_node_id,
        target_port_id=target_port_id,
        data_type=data_type,
    )


@pytest.fixture
def minimal_project() -> Project:
    """Simplest valid project: input → agent → output."""
    input_node = make_node(
        "input", "n_input",
        config={"trigger": "http"},
        outputs=[make_port("payload", "Payload", "json")],
    )
    agent_node = make_node(
        "agent", "n_agent",
        config={
            "model_id": "anthropic.claude-3-5-sonnet-20241022-v2:0",
            "system_prompt": "You are helpful.",
            "tools": [],
        },
        inputs=[make_port("message", "User message", "any", required=True)],
        outputs=[make_port("response", "Agent response", "string")],
    )
    output_node = make_node(
        "output", "n_output",
        config={"mode": "json"},
        inputs=[make_port("payload", "Payload", "any", required=True)],
    )
    edges = [
        make_edge("n_input", "payload", "n_agent", "message", "json"),
        make_edge("n_agent", "response", "n_output", "payload", "string"),
    ]
    return Project(name="test-agent", nodes=[input_node, agent_node, output_node], edges=edges)


@pytest.fixture
def project_with_condition(minimal_project: Project) -> Project:
    """Adds a condition node after the agent."""
    cond_node = make_node(
        "condition", "n_cond",
        config={"expression": "response == 'yes'", "expression_language": "jmespath"},
        inputs=[make_port("payload", "Payload", "any", required=True)],
        outputs=[
            make_port("true", "True branch", "any"),
            make_port("false", "False branch", "any"),
        ],
    )
    yes_output = make_node(
        "output", "n_output_yes",
        config={"mode": "json"},
        inputs=[make_port("payload", "Payload", "any", required=True)],
    )
    # Re-wire: agent → condition → yes_output / existing output
    p = minimal_project
    # Remove old agent→output edge, replace with agent→cond + cond branches
    new_edges = [e for e in p.edges if not (e.source_node_id == "n_agent" and e.target_node_id == "n_output")]
    new_edges += [
        make_edge("n_agent", "response", "n_cond", "payload"),
        make_edge("n_cond", "true", "n_output_yes", "payload"),
        make_edge("n_cond", "false", "n_output", "payload"),
    ]
    return Project(
        name="test-agent-cond",
        nodes=p.nodes + [cond_node, yes_output],
        edges=new_edges,
    )
