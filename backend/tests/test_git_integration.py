"""Tests for engine/integrations/git.py and the /git/push, /git/pull endpoints.

All HTTP calls are stubbed by replacing engine.integrations.git._http with a
deterministic fake that records calls and returns canned responses.
"""
from __future__ import annotations

import base64
import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from engine import main as engine_main
from engine.integrations import git as git_mod
from engine.integrations.git import (
    GitHubClient,
    GitLabClient,
    GitProviderError,
)


client = TestClient(engine_main.app)


@pytest.fixture
def fake_http(monkeypatch):
    """Replace _http with a programmable stub. Returns the call log."""
    calls: list[dict] = []
    responses: dict[tuple[str, str], Any] = {}

    def setup(method: str, url_substr: str, response: Any) -> None:
        responses[(method, url_substr)] = response

    def fake(method: str, url: str, *, headers: dict, body: dict | None = None):
        calls.append({"method": method, "url": url, "headers": headers, "body": body})
        # Longest-substring match wins so '/git/ref/heads/main' beats '/repos/o/r'.
        candidates = [
            ((m, u), resp)
            for (m, u), resp in responses.items()
            if m == method and u in url
        ]
        candidates.sort(key=lambda kv: len(kv[0][1]), reverse=True)
        for (_, _), resp in candidates:
            if isinstance(resp, Exception):
                raise resp
            return resp
        raise GitProviderError(f"unmocked: {method} {url}")

    monkeypatch.setattr(git_mod, "_http", fake)
    return {"calls": calls, "setup": setup}


# ─── GitHubClient unit tests ──────────────────────────────────────────────

def test_github_from_repo_rejects_bad_format():
    with pytest.raises(GitProviderError, match="owner/name"):
        GitHubClient.from_repo("not-a-slash", token="tok")


def test_github_get_file_decodes_base64(fake_http):
    fake_http["setup"]("GET", "/contents/", {
        "content": base64.b64encode(b'{"hello": "world"}').decode(),
        "encoding": "base64",
    })
    gh = GitHubClient.from_repo("o/r", "tok")
    assert gh.get_file("project.json", "main") == '{"hello": "world"}'


def test_github_push_files_creates_tree_commit_and_updates_ref(fake_http):
    fake_http["setup"]("GET", "/git/ref/heads/main", {"object": {"sha": "base-sha"}})
    fake_http["setup"]("GET", "/git/commits/base-sha", {"tree": {"sha": "base-tree"}})
    fake_http["setup"]("POST", "/git/blobs", {"sha": "blob-sha"})
    fake_http["setup"]("POST", "/git/trees", {"sha": "new-tree-sha"})
    fake_http["setup"]("POST", "/git/commits", {
        "sha": "new-commit-sha",
        "html_url": "https://github.com/o/r/commit/new-commit-sha",
    })
    fake_http["setup"]("PATCH", "/git/refs/heads/main", {})

    gh = GitHubClient.from_repo("o/r", "tok")
    out = gh.push_files(
        files={"agent/runner.py": "print('x')", "infra/main.tf": "# tf"},
        branch="main",
        commit_message="msg",
    )
    assert out["commit_sha"] == "new-commit-sha"
    assert "github.com/o/r/commit" in out["commit_url"]

    methods = [c["method"] for c in fake_http["calls"]]
    # 2 blobs + 1 tree + 1 commit + 1 ref patch + initial GETs
    assert methods.count("POST") >= 4


def test_github_push_creates_branch_when_missing(fake_http):
    fake_http["setup"]("GET", "/git/ref/heads/feature", GitProviderError("HTTP 404"))
    fake_http["setup"]("GET", "/repos/o/r", {"default_branch": "main"})
    fake_http["setup"]("GET", "/git/ref/heads/main", {"object": {"sha": "main-sha"}})
    fake_http["setup"]("GET", "/git/commits/main-sha", {"tree": {"sha": "main-tree"}})
    fake_http["setup"]("POST", "/git/blobs", {"sha": "blob-sha"})
    fake_http["setup"]("POST", "/git/trees", {"sha": "tree-sha"})
    fake_http["setup"]("POST", "/git/commits", {"sha": "commit-sha"})
    fake_http["setup"]("POST", "/git/refs", {})

    gh = GitHubClient.from_repo("o/r", "tok")
    gh.push_files({"x.txt": "hi"}, "feature", "msg")

    create_ref_calls = [c for c in fake_http["calls"] if c["method"] == "POST" and "/git/refs" in c["url"] and c["url"].endswith("/git/refs")]
    assert len(create_ref_calls) == 1
    assert create_ref_calls[0]["body"] == {"ref": "refs/heads/feature", "sha": "commit-sha"}


# ─── GitLabClient unit tests ──────────────────────────────────────────────

def test_gitlab_from_repo_rejects_bad_format():
    with pytest.raises(GitProviderError, match="group/project"):
        GitLabClient.from_repo("nopath", token="tok")


def test_gitlab_get_file_decodes(fake_http):
    fake_http["setup"]("GET", "/repository/files/", {
        "content": base64.b64encode(b'{"a":1}').decode(),
    })
    gl = GitLabClient.from_repo("g/p", "tok")
    assert gl.get_file("project.json", "main") == '{"a":1}'


def test_gitlab_push_uses_single_commit_with_create_or_update(fake_http):
    # File 1 exists, file 2 doesn't
    def get_file_setup():
        fake_http["setup"]("GET", "/repository/files/agent%2Frunner.py", {
            "content": base64.b64encode(b"old").decode(),
        })
        fake_http["setup"]("GET", "/repository/files/infra%2Fmain.tf",
                           GitProviderError("HTTP 404"))

    get_file_setup()
    fake_http["setup"]("GET", "/repository/branches/main", {})  # branch exists
    fake_http["setup"]("POST", "/repository/commits", {
        "id": "abc123",
        "web_url": "https://gitlab.com/g/p/-/commit/abc123",
    })

    gl = GitLabClient.from_repo("g/p", "tok")
    out = gl.push_files(
        files={"agent/runner.py": "new", "infra/main.tf": "tf"},
        branch="main",
        commit_message="msg",
    )
    assert out["commit_sha"] == "abc123"

    commit_calls = [c for c in fake_http["calls"] if c["method"] == "POST" and "/repository/commits" in c["url"]]
    assert len(commit_calls) == 1
    actions = commit_calls[0]["body"]["actions"]
    by_path = {a["file_path"]: a["action"] for a in actions}
    assert by_path["agent/runner.py"] == "update"
    assert by_path["infra/main.tf"] == "create"


def test_gitlab_push_creates_branch_via_start_branch_when_missing(fake_http):
    fake_http["setup"]("GET", "/repository/files/", GitProviderError("HTTP 404"))
    fake_http["setup"]("GET", "/repository/branches/feature", GitProviderError("HTTP 404"))
    fake_http["setup"]("GET", "/api/v4/projects/g%2Fp", {"default_branch": "main"})
    fake_http["setup"]("POST", "/repository/commits", {"id": "sha"})

    gl = GitLabClient.from_repo("g/p", "tok")
    gl.push_files({"x.txt": "hi"}, "feature", "msg")

    commit_call = next(c for c in fake_http["calls"] if c["method"] == "POST" and "/repository/commits" in c["url"])
    assert commit_call["body"]["start_branch"] == "main"


# ─── HTTP endpoint tests ──────────────────────────────────────────────────

def _minimal_project_dict() -> dict:
    """Same shape as the conftest minimal_project but as a dict."""
    return {
        "name": "test-agent",
        "nodes": [
            {
                "id": "n_input", "type": "input", "label": "Input",
                "position": {"x": 0, "y": 0},
                "config": {"trigger": "http"},
                "ports": {
                    "inputs": [],
                    "outputs": [{"id": "payload", "name": "Payload", "data_type": "json", "required": False}],
                },
            },
            {
                "id": "n_agent", "type": "agent", "label": "Agent",
                "position": {"x": 0, "y": 0},
                "config": {
                    "model_id": "anthropic.claude-3-5-sonnet-20241022-v2:0",
                    "system_prompt": "Be helpful.",
                    "tools": [],
                },
                "ports": {
                    "inputs": [{"id": "message", "name": "User message", "data_type": "any", "required": True}],
                    "outputs": [{"id": "response", "name": "Agent response", "data_type": "string", "required": False}],
                },
            },
            {
                "id": "n_output", "type": "output", "label": "Output",
                "position": {"x": 0, "y": 0},
                "config": {"mode": "json"},
                "ports": {
                    "inputs": [{"id": "payload", "name": "Payload", "data_type": "any", "required": True}],
                    "outputs": [],
                },
            },
        ],
        "edges": [
            {
                "id": "e1",
                "source_node_id": "n_input", "source_port_id": "payload",
                "target_node_id": "n_agent", "target_port_id": "message",
                "data_type": "any",
            },
            {
                "id": "e2",
                "source_node_id": "n_agent", "source_port_id": "response",
                "target_node_id": "n_output", "target_port_id": "payload",
                "data_type": "any",
            },
        ],
    }


def test_git_push_endpoint_runs_pipeline_and_commits(fake_http):
    fake_http["setup"]("GET", "/git/ref/heads/main", {"object": {"sha": "base"}})
    fake_http["setup"]("GET", "/git/commits/base", {"tree": {"sha": "base-tree"}})
    fake_http["setup"]("POST", "/git/blobs", {"sha": "blob"})
    fake_http["setup"]("POST", "/git/trees", {"sha": "tree"})
    fake_http["setup"]("POST", "/git/commits", {
        "sha": "deadbeef",
        "html_url": "https://github.com/o/r/commit/deadbeef",
    })
    fake_http["setup"]("PATCH", "/git/refs/heads/main", {})

    res = client.post("/git/push", json={
        "provider": "github",
        "repo": "o/r",
        "branch": "main",
        "token": "tok",
        "commit_message": "Generate from Studio",
        "project": _minimal_project_dict(),
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"] is True
    assert body["commit_sha"] == "deadbeef"
    assert body["files_committed"] > 0


def test_git_push_rejects_invalid_graph(fake_http):
    bad = _minimal_project_dict()
    bad["nodes"][1]["config"].pop("system_prompt")  # required field for agent
    res = client.post("/git/push", json={
        "provider": "github",
        "repo": "o/r",
        "branch": "main",
        "token": "tok",
        "commit_message": "x",
        "project": bad,
    })
    assert res.status_code == 422
    assert "errors" in res.json()["detail"]


def test_git_push_surfaces_provider_errors(fake_http):
    fake_http["setup"]("GET", "/git/ref/heads/main", GitProviderError("HTTP 401: bad token"))
    fake_http["setup"]("GET", "/repos/o/r", GitProviderError("HTTP 401: bad token"))

    res = client.post("/git/push", json={
        "provider": "github",
        "repo": "o/r",
        "branch": "main",
        "token": "wrong",
        "commit_message": "x",
        "project": _minimal_project_dict(),
    })
    assert res.status_code == 502
    assert "401" in res.json()["detail"]["message"]


def test_git_pull_returns_parsed_project(fake_http):
    proj = _minimal_project_dict()
    fake_http["setup"]("GET", "/contents/project.json", {
        "content": base64.b64encode(json.dumps(proj).encode()).decode(),
        "encoding": "base64",
    })

    res = client.post("/git/pull", json={
        "provider": "github",
        "repo": "o/r",
        "ref": "main",
        "token": "tok",
        "path": "project.json",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["project"]["name"] == "test-agent"
    assert len(body["project"]["nodes"]) == 3


def test_git_pull_rejects_bad_json(fake_http):
    fake_http["setup"]("GET", "/contents/project.json", {
        "content": base64.b64encode(b"this is not json").decode(),
        "encoding": "base64",
    })

    res = client.post("/git/pull", json={
        "provider": "github",
        "repo": "o/r",
        "ref": "main",
        "token": "tok",
        "path": "project.json",
    })
    assert res.status_code == 422
