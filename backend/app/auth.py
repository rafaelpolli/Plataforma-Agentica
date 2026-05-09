"""JWT-based authentication for the DCM platform.

Stateless — no session storage. Tokens carry user identity + role.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.dcm.mock_data import LOGIN_MAP, USERS

# ── Config ───────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "jaguardata-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 720  # 30 days

bearer_scheme = HTTPBearer(auto_error=False)

# ── Auth router ──────────────────────────────────────────────────────────────
router = APIRouter()


class LoginBody(BaseModel):
    username: str
    password: str


# ── Token helpers ────────────────────────────────────────────────────────────

def create_token(username: str, role: str) -> str:
    user = USERS.get(role, USERS["viewer"])
    payload = {
        "sub": username,
        "role": role,
        "user_id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


# ── FastAPI dependencies ─────────────────────────────────────────────────────

def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict:
    """Extract and validate JWT from Authorization header. Returns user payload."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


def get_role(user: Annotated[dict, Depends(get_current_user)]) -> str:
    return user.get("role", "viewer")


def require_role(*roles: str):
    """Factory: create a dependency that requires one of the given roles."""
    def checker(user: Annotated[dict, Depends(get_current_user)]) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/login")
def login(body: LoginBody) -> dict:
    role = LOGIN_MAP.get(body.username.lower().strip())
    if not role:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(body.username.strip(), role)
    user = USERS[role]
    return {"ok": True, "token": token, "user": user}


@router.get("/me")
def me(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    return {
        "id": user["user_id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
    }


@router.post("/logout")
def logout() -> dict:
    return {"ok": True}
