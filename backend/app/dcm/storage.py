"""SQLite persistence layer for DCM contracts and change requests.

Falls back to in-memory dicts when SQLite is unavailable.
"""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

# ── DB path ──────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parents[2]  # backend/
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "dcm.sqlite3"
DB_PATH = Path(os.getenv("DCM_DATABASE_PATH", str(DEFAULT_DB_PATH)))


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _dump(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def _load(payload: str) -> dict[str, Any]:
    return json.loads(payload)


# ── Init ─────────────────────────────────────────────────────────────────────

def init_database(seed_contracts: dict[str, dict], seed_requests: dict[str, dict]) -> tuple[dict, dict]:
    """Initialize SQLite and seed if empty. Returns (contracts, requests) dicts."""
    try:
        with _connect() as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute(
                """CREATE TABLE IF NOT EXISTS contracts (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL,
                    domain TEXT, layer TEXT, updated_at TEXT, payload TEXT NOT NULL
                )"""
            )
            conn.execute(
                """CREATE TABLE IF NOT EXISTS change_requests (
                    id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL,
                    type TEXT, contract_id TEXT, requester TEXT, updated_at TEXT,
                    payload TEXT NOT NULL
                )"""
            )
            has_data = conn.execute("SELECT 1 FROM contracts LIMIT 1").fetchone()
            if not has_data:
                for c in seed_contracts.values():
                    _upsert_contract(conn, c)
                for r in seed_requests.values():
                    _upsert_change_request(conn, r)

        return load_contracts(), load_change_requests()
    except Exception:
        # SQLite unavailable — fall back to in-memory dicts
        import copy
        return copy.deepcopy(seed_contracts), copy.deepcopy(seed_requests)


def load_contracts() -> dict[str, dict]:
    try:
        with _connect() as conn:
            rows = conn.execute("SELECT payload FROM contracts ORDER BY id").fetchall()
        return {item["id"]: item for item in (_load(r["payload"]) for r in rows)}
    except Exception:
        return {}


def load_change_requests() -> dict[str, dict]:
    try:
        with _connect() as conn:
            rows = conn.execute("SELECT payload FROM change_requests ORDER BY id").fetchall()
        return {item["id"]: item for item in (_load(r["payload"]) for r in rows)}
    except Exception:
        return {}


def save_contract(contract: dict) -> None:
    try:
        with _connect() as conn:
            _upsert_contract(conn, contract)
    except Exception:
        pass


def save_change_request(request: dict) -> None:
    try:
        with _connect() as conn:
            _upsert_change_request(conn, request)
    except Exception:
        pass


def _upsert_contract(conn: sqlite3.Connection, contract: dict) -> None:
    conn.execute(
        """INSERT INTO contracts (id, name, status, domain, layer, updated_at, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, status=excluded.status, domain=excluded.domain,
            layer=excluded.layer, updated_at=excluded.updated_at, payload=excluded.payload""",
        (
            contract["id"], contract.get("name", ""), contract.get("status", ""),
            contract.get("domain", ""), contract.get("location", {}).get("layer", ""),
            contract.get("updated_at", ""), _dump(contract),
        ),
    )


def _upsert_change_request(conn: sqlite3.Connection, request: dict) -> None:
    conn.execute(
        """INSERT INTO change_requests (id, title, status, type, contract_id, requester, updated_at, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, status=excluded.status, type=excluded.type,
            contract_id=excluded.contract_id, requester=excluded.requester,
            updated_at=excluded.updated_at, payload=excluded.payload""",
        (
            request["id"], request.get("title", ""), request.get("status", ""),
            request.get("type", ""), request.get("contract_id", ""),
            request.get("requester", ""), request.get("updated_at", ""), _dump(request),
        ),
    )
