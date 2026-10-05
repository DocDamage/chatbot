"""Dashboard API: D2 (launch), D3 (profiles), D6 (upload), D11 (CORS) and the missing token."""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from dabook.config.models import PROFILES
from dabook.server.app import allowed_origins, create_app, dashboard_url, get_token
from tests.conftest import Pipeline

AUTH = {"Authorization": f"Bearer {get_token()}"}


@pytest.fixture()
def api(tmp_path: Path):
    pipe = Pipeline(tmp_path / "ws")
    client = TestClient(create_app(pipe.db_path, pipe.ws, port=8765))
    yield client, pipe
    client.close()
    pipe.close()


def test_mutating_endpoints_require_the_token(api, tech_pdf: Path) -> None:
    client, _ = api
    assert client.post("/api/launch", json={"paths": [str(tech_pdf)]}).status_code == 403
    assert client.post("/api/launch", json={"paths": [str(tech_pdf)]}, headers={"Authorization": "Bearer nope"}).status_code == 403
    assert client.post("/api/upload", files=[("files", ("a.pdf", b"x", "application/pdf"))]).status_code == 403
    assert client.get("/api/health").json()["ok"] is True  # reads stay open


def test_dashboard_url_carries_the_token() -> None:
    """The browser must be opened with the token or every button returns 403."""
    assert f"?t={get_token()}" in dashboard_url(8765)
    assert dashboard_url(8765, fragment="settings").endswith("#settings")


def test_launch_enqueues_in_process_and_the_book_runs_to_done(api, tech_pdf: Path) -> None:
    client, pipe = api
    r = client.post("/api/launch", json={"paths": [str(tech_pdf)], "profile": "balanced"}, headers=AUTH)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True and body["errors"] == []
    (queued,) = body["queued"]
    assert queued["state"] == "queued" and queued["pages"] == 8

    books = client.get("/api/books").json()
    assert [b["state"] for b in books] == ["queued"]

    pipe.drain()  # stands in for the running supervisor's workers
    assert client.get("/api/books").json()[0]["state"] == "done"
    detail = client.get(f"/api/books/{queued['book_id']}").json()
    assert detail["title"] == "Disk Recovery Handbook" and detail["quality_score"] is not None


@pytest.mark.parametrize("profile", ["accurate", "lowram", "fast", "balanced"])
def test_real_profiles_are_accepted_and_recorded(api, tech_pdf: Path, profile: str) -> None:
    client, pipe = api
    r = client.post("/api/launch", json={"paths": [str(tech_pdf)], "profile": profile}, headers=AUTH)
    assert r.status_code == 200, r.text
    assert pipe.book(r.json()["queued"][0]["book_id"])["profile"] == profile


@pytest.mark.parametrize("profile", ["quality", "archive", "nonsense"])
def test_unknown_profiles_are_a_400_not_a_silent_fallback(api, tech_pdf: Path, profile: str) -> None:
    client, pipe = api
    r = client.post("/api/launch", json={"paths": [str(tech_pdf)], "profile": profile}, headers=AUTH)
    assert r.status_code == 400
    assert "Unknown profile" in r.json()["detail"]
    assert pipe.con.execute("SELECT COUNT(*) FROM books").fetchone()[0] == 0


def test_invalid_formats_and_modes_are_rejected(api, tech_pdf: Path) -> None:
    client, _ = api
    bad_format = client.post("/api/launch", json={"paths": [str(tech_pdf)], "formats": "orc"}, headers=AUTH)
    assert bad_format.status_code == 400 and "dataset.formats" in bad_format.json()["detail"]
    bad_provider_style = client.post("/api/launch", json={"paths": [str(tech_pdf)], "profile": "nope"}, headers=AUTH)
    assert bad_provider_style.status_code == 400
    bad_mode = client.post("/api/launch", json={"paths": [str(tech_pdf)], "modes": "raw,instruct"}, headers=AUTH)
    assert bad_mode.status_code == 400 and "dataset.modes" in bad_mode.json()["detail"]


def test_launch_rejects_a_different_workspace_and_missing_files(api, tech_pdf: Path, tmp_path: Path) -> None:
    client, _ = api
    other = client.post(
        "/api/launch", json={"paths": [str(tech_pdf)], "output_dir": str(tmp_path / "elsewhere")}, headers=AUTH
    )
    assert other.status_code == 400 and "serves the workspace" in other.json()["detail"]
    nothing = client.post("/api/launch", json={"paths": [str(tmp_path / "nope.pdf")]}, headers=AUTH)
    assert nothing.status_code == 400


def test_launch_reports_unreadable_pdfs_per_file(api, tech_pdf: Path, tmp_path: Path) -> None:
    client, _ = api
    junk = tmp_path / "junk.pdf"
    junk.write_bytes(b"not a pdf")
    r = client.post("/api/launch", json={"paths": [str(junk), str(tech_pdf)]}, headers=AUTH)
    body = r.json()
    assert len(body["queued"]) == 1 and len(body["errors"]) == 1
    assert "corrupt_pdf" in body["errors"][0]["error"]


def test_upload_saves_safely_and_enqueues_immediately(api, tech_pdf: Path) -> None:
    client, pipe = api
    data = tech_pdf.read_bytes()
    r = client.post(
        "/api/upload",
        files=[("files", ("../../escape attempt.pdf", data, "application/pdf")), ("files", ("notes.txt", b"hi", "text/plain"))],
        headers=AUTH,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    (saved,) = [Path(p) for p in body["saved"]]
    assert saved.parent == pipe.ws / "inbox"  # path traversal neutralised
    assert saved.name == "escape attempt.pdf" and saved.read_bytes() == data
    assert body["queued"][0]["state"] == "queued"  # D6: upload actually enqueues
    pipe.drain()
    assert pipe.book(body["queued"][0]["book_id"])["state"] == "done"


def test_upload_never_overwrites_an_earlier_file(api, tech_pdf: Path, pdf_dir: Path) -> None:
    client, pipe = api
    for src in (tech_pdf, pdf_dir / "twocol.pdf"):
        r = client.post("/api/upload", files=[("files", ("same.pdf", src.read_bytes(), "application/pdf"))], headers=AUTH)
        assert r.status_code == 200
    assert sorted(p.name for p in (pipe.ws / "inbox").glob("*.pdf")) == ["same-1.pdf", "same.pdf"]


def test_upload_without_pdfs_is_a_400(api) -> None:
    client, _ = api
    assert client.post("/api/upload", files=[("files", ("n.txt", b"x", "text/plain"))], headers=AUTH).status_code == 400


# --------------------------------------------------------------------------- D11
def preflight(client: TestClient, origin: str):
    return client.options(
        "/api/launch",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )


@pytest.mark.parametrize("origin", ["http://localhost:3000", "http://127.0.0.1:3000", "http://127.0.0.1:8765"])
def test_cors_allows_the_chatbot_ui_and_the_dashboard(api, origin: str) -> None:
    client, _ = api
    r = preflight(client, origin)
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == origin


@pytest.mark.parametrize("origin", ["https://evil.example", "http://localhost:4000", "http://localhost.evil.com:3000"])
def test_cors_rejects_other_origins(api, origin: str) -> None:
    client, _ = api
    assert "access-control-allow-origin" not in preflight(client, origin).headers


def test_cors_origins_are_configurable(tmp_path: Path) -> None:
    pipe = Pipeline(tmp_path / "ws")
    try:
        client = TestClient(create_app(pipe.db_path, pipe.ws, port=9000, cors_origins=["http://chatbot.internal:5173"]))
        assert preflight(client, "http://chatbot.internal:5173").headers["access-control-allow-origin"] == "http://chatbot.internal:5173"
        assert "http://127.0.0.1:9000" in allowed_origins(9000)
    finally:
        pipe.close()


# --------------------------------------------------------------------------- D3 (UI side)
def test_every_profile_the_ui_offers_exists() -> None:
    html = (Path(__file__).parents[2] / "src/dabook/server/static/index.html").read_text(encoding="utf-8")
    block = re.search(r'<select id="launch-profile".*?</select>', html, re.S).group(0)
    offered = set(re.findall(r'<option value="([^"]+)"', block))
    assert offered and offered <= set(PROFILES)


def test_every_mode_and_format_the_ui_offers_is_implemented() -> None:
    from dabook.config.models import ALLOWED_DATASET_MODES, ALLOWED_FORMATS

    html = (Path(__file__).parents[2] / "src/dabook/server/static/index.html").read_text(encoding="utf-8")
    for select, allowed in (("launch-modes", ALLOWED_DATASET_MODES), ("launch-formats", ALLOWED_FORMATS)):
        block = re.search(rf'<select id="{select}".*?</select>', html, re.S).group(0)
        for value in re.findall(r'<option value="([^"]+)"', block):
            assert set(value.split(",")) <= set(allowed), (select, value)
