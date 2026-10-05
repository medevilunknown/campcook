"""Tests for Emergent-managed Google sign-in endpoints and config flags."""
import uuid

import pytest
import requests
from dotenv import dotenv_values

BASE_URL = dotenv_values("/app/frontend/.env")["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


@pytest.fixture
def api():
    return requests.Session()


def test_google_config_available(api):
    """GET /api/auth/google reports managed sign-in available; /api/config flag set."""
    google = api.get(f"{BASE_URL}/api/auth/google")
    assert google.status_code == 200
    assert google.json()["available"] is True
    config = api.get(f"{BASE_URL}/api/config")
    assert config.json()["google_managed_ready"] is True


def test_auth_me_requires_token(api):
    """GET /api/auth/me without a token returns 401."""
    response = api.get(f"{BASE_URL}/api/auth/me")
    assert response.status_code == 401
    assert "sign in" in response.json()["detail"].lower()


def test_auth_me_rejects_unknown_token(api):
    response = api.get(f"{BASE_URL}/api/auth/me", headers={"x-session-token": "TEST_bogus_token"})
    assert response.status_code == 401


def test_session_exchange_invalid_id_returns_401_and_replay_guard(api):
    """Invalid session_id -> 401 'Invalid or expired'; replay of same id -> 401 'already used'."""
    session_id = f"TEST-fake-{uuid.uuid4().hex[:12]}"
    first = api.post(f"{BASE_URL}/api/auth/session", json={"session_id": session_id})
    assert first.status_code == 401
    assert "Invalid or expired" in first.json()["detail"]

    second = api.post(f"{BASE_URL}/api/auth/session", json={"session_id": session_id})
    assert second.status_code == 401
    assert "already used" in second.json()["detail"]


def test_session_exchange_validates_input(api):
    """Too-short session_id rejected with 422 before hitting the one-time guard."""
    response = api.post(f"{BASE_URL}/api/auth/session", json={"session_id": "abc"})
    assert response.status_code == 422
