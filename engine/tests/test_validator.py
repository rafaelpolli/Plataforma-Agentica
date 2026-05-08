"""Tests for Phase 1: Validator."""
from __future__ import annotations

import pytest

from engine.models.graph import Edge, Node, NodePorts, Port, Position, Project
from engine.pipeline.validator import validate
from tests.conftest import make_edge, make_node, make_port


def test_valid_minimal_project(minimal_project):
    result = validate(minimal_project)
    assert result.valid
    assert result.errors == []


def test_topological_sort_order(minimal_project):
    result = validate(minimal_project)
    ids = [n.id for n in result.sorted_nodes]
    assert ids.index("n_input") < ids.index("n_agent")
    assert ids.index("n_agent") < ids.index("n_output")


def test_missing_input_node():
    agent = make_node("agent", config={"model_id": "x", "system_prompt": "y"})
    output = make_node("output", config={"mode": "json"})
    p = Project(name="x", nodes=[agent, output], edges=[])
    result = validate(p)
    assert not result.valid
    assert any(e.code == "MISSING_INPUT_NODE" for e in result.errors)


def test_missing_output_node():
    inp = make_node("input", config={"trigger": "http"})
    p = Project(name="x", nodes=[inp], edges=[])
    result = validate(p)
    assert not result.valid
    assert any(e.code == "MISSING_OUTPUT_NODE" for e in result.errors)


def test_missing_required_config_field():
    inp = make_node("input", "n_in", config={"trigger": "http"})
    # agent missing system_prompt
    agent = make_node("agent", "n_ag", config={"model_id": "x"})
    out = make_node("output", "n_out", config={"mode": "json"})
    p = Project(name="x", nodes=[inp, agent, out], edges=[])
    result = validate(p)
    assert not result.valid
    assert any(e.code == "MISSING_REQUIRED_FIELD" and "system_prompt" in e.field for e in result.errors)


def test_unsafe_athena_query_template():
    inp = make_node("input", "n_in", config={"trigger": "http"})
    out = make_node("output", "n_out", config={"mode": "json"})
    athena = make_node("tool_athena", "n_ath", config={
        "name": "q",
        "description": "d",
        "database": "db",
        "query_template": "SELECT * FROM t WHERE id = {customer_id}",  # unsafe
        "output_location": "s3://bucket/",
    })
    p = Project(name="x", nodes=[inp, athena, out], edges=[])
    result = validate(p)
    assert any(e.code == "UNSAFE_QUERY_TEMPLATE" for e in result.errors)


def test_safe_athena_query_template():
    inp = make_node("input", "n_in", config={"trigger": "http"})
    out = make_node("output", "n_out", config={"mode": "json"})
    athena = make_node("tool_athena", "n_ath", config={
        "name": "q",
        "description": "d",
        "database": "db",
        "query_template": "SELECT * FROM t WHERE id = ?",  # safe
        "output_location": "s3://bucket/",
    })
    p = Project(name="x", nodes=[inp, athena, out], edges=[])
    result = validate(p)
    assert not any(e.code == "UNSAFE_QUERY_TEMPLATE" for e in result.errors)


def test_invalid_condition_expression_language():
    inp = make_node("input", "n_in", config={"trigger": "http"})
    out = make_node("output", "n_out", config={"mode": "json"})
    cond = make_node("condition", "n_cond", config={
        "expression": "x > 0",
        "expression_language": "eval",  # prohibited
    })
    p = Project(name="x", nodes=[inp, cond, out], edges=[])
    result = validate(p)
    assert any(e.code == "INVALID_EXPRESSION_LANGUAGE" for e in result.errors)


def test_cycle_detection():
    # A → B → A (cycle)
    a = make_node("agent", "n_a", config={"model_id": "x", "system_prompt": "y"},
                  outputs=[make_port("out", "Out", "string")])
    b = make_node("agent", "n_b", config={"model_id": "x", "system_prompt": "y"},
                  inputs=[make_port("in", "In", "string")])
    inp = make_node("input", "n_in", config={"trigger": "http"})
    out = make_node("output", "n_out", config={"mode": "json"})
    edges = [
        make_edge("n_a", "out", "n_b", "in", "string"),
        make_edge("n_b", "in", "n_a", "out", "string"),  # cycle
    ]
    p = Project(name="x", nodes=[inp, a, b, out], edges=edges)
    result = validate(p)
    assert any(e.code == "CYCLE_DETECTED" for e in result.errors)


def test_type_mismatch_on_edge():
    inp = make_node("input", "n_in", config={"trigger": "http"},
                    outputs=[make_port("payload", "Payload", "json")])
    agent = make_node("agent", "n_ag", config={"model_id": "x", "system_prompt": "y"},
                      inputs=[make_port("message", "Msg", "string", required=True)])
    out = make_node("output", "n_out", config={"mode": "json"},
                    inputs=[make_port("payload", "Payload", "any")])
    edges = [
        make_edge("n_in", "payload", "n_ag", "message", "json"),  # json → string mismatch
    ]
    p = Project(name="x", nodes=[inp, agent, out], edges=edges)
    result = validate(p)
    assert any(e.code == "TYPE_MISMATCH" for e in result.errors)


def test_invalid_edge_references():
    inp = make_node("input", "n_in", config={"trigger": "http"})
    out = make_node("output", "n_out", config={"mode": "json"})
    bad_edge = make_edge("n_in", "payload", "nonexistent_node", "payload")
    p = Project(name="x", nodes=[inp, out], edges=[bad_edge])
    result = validate(p)
    assert any(e.code == "INVALID_EDGE_TARGET" for e in result.errors)


def test_inference_profile_arn_accepted_without_model_id():
    inp = make_node("input", "n_in", config={"trigger": "http"})
    out = make_node("output", "n_out", config={"mode": "json"})
    agent = make_node("agent", "n_ag", config={
        "model_id": "",
        "inference_profile_arn": "arn:aws:bedrock:us-east-1:123:inference-profile/x",
        "system_prompt": "y",
    })
    p = Project(name="x", nodes=[inp, agent, out], edges=[])
    result = validate(p)
    assert not any(e.code == "MISSING_MODEL_CONFIG" for e in result.errors)
