"""Cliente de ejemplo: recorre todos los endpoints contra un servidor en ejecución.

Uso:
  .venv\\Scripts\\python.exe scripts\\demo_client.py [URL] [ruta_audio]
  (por defecto http://127.0.0.1:8000 y tests/fixtures/student_sentence.webm)

Sirve como referencia para el equipo de la aplicación principal.
"""
import json
import os
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
AUDIO = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "tests" / "fixtures" / "student_sentence.webm"
HEADERS = {"X-API-Key": os.environ["THOMMY_API_KEY"]} if os.environ.get("THOMMY_API_KEY") else {}


def show(title, r: httpx.Response, t0: float):
    print(f"\n=== {title}  [{r.status_code}]  {time.perf_counter() - t0:.1f}s")
    print(json.dumps(r.json(), indent=2, ensure_ascii=False)[:1500])
    r.raise_for_status()
    return r.json()


with httpx.Client(base_url=BASE, timeout=180, headers=HEADERS) as c:
    t = time.perf_counter()
    show("GET /health", c.get("/health"), t)

    t = time.perf_counter()
    s = show("POST /session/start", c.post("/session/start", json={
        "student_id": "demo-001", "level": "A2", "topic": "school",
        "learning_goal": "Talk about yesterday using the past simple", "student_name": "Ana"}), t)
    sid = s["session_id"]
    wav = c.get(s["audio"]["url"])
    print(f"   greeting audio: {len(wav.content)} bytes, {wav.headers['content-type']}")

    t = time.perf_counter()
    with AUDIO.open("rb") as f:
        r = show("POST /conversation/audio", c.post("/conversation/audio", data={"session_id": sid},
                                                    files={"audio": (AUDIO.name, f)}), t)
    wav = c.get(r["audio"]["url"])
    print(f"   reply audio: {len(wav.content)} bytes")

    t = time.perf_counter()
    show("POST /conversation/text", c.post("/conversation/text", json={
        "session_id": sid, "message": "We play football and then we eat lunch together."}), t)

    t = time.perf_counter()
    show(f"GET /session/{sid}/progress", c.get(f"/session/{sid}/progress"), t)

    t = time.perf_counter()
    show("POST /session/end", c.post("/session/end", json={"session_id": sid}), t)
