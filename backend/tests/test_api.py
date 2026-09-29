"""
Smoke tests for the GradTrack API.

Run from the backend directory:  python -m pytest tests
The tests use a temporary SQLite file and memory store, and run the agent
without an LLM API key so no network calls are made.
"""

import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.pop("OPENROUTER_API_KEY", None)
os.environ.pop("OPENAI_API_KEY", None)

import main  # noqa: E402


@pytest.fixture()
def client(tmp_path):
    main.db_manager.db_path = str(tmp_path / "test.db")
    main.memory_manager.persist_directory = str(tmp_path / "memory_store")
    with TestClient(main.app) as c:
        yield c


def test_health(client):
    assert client.get("/api/health").status_code == 200


def test_application_crud(client):
    r = client.post("/api/applications", json={
        "school_name": "MIT",
        "program_name": "PhD Computer Science",
        "degree_type": "PhD",
        "status": "researching",
    })
    assert r.status_code == 200
    apps = client.get("/api/applications").json()
    assert any(a["school_name"] == "MIT" for a in apps["applications"])


def test_chat_returns_reasoning_steps(client):
    r = client.post("/api/chat", json={"message": "What are my applications?"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body["response"], str)
    steps = body["reasoning_steps"]
    assert steps, "expected a reasoning trace"
    assert {"step", "message"} <= steps[0].keys()
