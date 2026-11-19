"""Pruebas de integración de la API con los motores reales (lentas en CPU: ~1-3 min)."""
import base64
import io
import wave

import pytest


@pytest.fixture(scope="module")
def session(client):
    r = client.post("/session/start", json={
        "student_id": "test-student", "level": "A2", "topic": "school",
        "learning_goal": "Talk about past events with the past simple",
    })
    assert r.status_code == 200, r.text
    return r.json()


def _assert_wav(data: bytes):
    """Comprueba que es audio reproducible: WAV válido o MP3 (cabecera ID3 o sincronía de trama)."""
    if data[:4] == b"RIFF":
        with wave.open(io.BytesIO(data), "rb") as w:
            assert w.getnframes() > 0
            assert w.getframerate() > 0
    else:
        assert len(data) > 1000
        assert data[:3] == b"ID3" or (data[0] == 0xFF and data[1] & 0xE0 == 0xE0), data[:8]


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok", body


def test_swagger_available(client):
    assert client.get("/docs").status_code == 200
    assert "/conversation/audio" in client.get("/openapi.json").json()["paths"]


def test_start_session_returns_greeting_and_audio(client, session):
    assert len(session["session_id"]) == 32
    assert session["greeting"]
    assert session["audio"]["url"].startswith(f"/audio/{session['session_id']}/")
    r = client.get(session["audio"]["url"])
    assert r.status_code == 200 and r.headers["content-type"] == session["audio"]["mime_type"]
    _assert_wav(r.content)


def test_text_message(client, session):
    r = client.post("/conversation/text", json={"session_id": session["session_id"],
                                                "message": "Yesterday I go to the school.",
                                                "include_audio_base64": True})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["transcription"] == "Yesterday I go to the school."
    assert body["reply"]
    assert body["pronunciation"]["available"] is False
    assert body["evaluation"]["kind"] == "grammar"
    if body["correction"]:  # con corrección no puede salir "excelente"
        assert body["evaluation"]["level"] != "excelente"
    _assert_wav(base64.b64decode(body["audio"]["base64"]))
    print("\nTHOMMY:", body["reply"], "| correction:", body["correction"], "| eval:", body["evaluation"]["score"])


LESSON = {"title": "Introducing yourself", "objective": "Introduce yourself using adjectives",
          "grammar": ["Adjectives"], "vocabulary": ["introduce", "meet", "friendly", "funny"],
          "model_phrases": ["Hi, let me introduce myself.", "I am friendly and funny.", "Nice to meet you."]}


def test_lesson_practice_flow(client):
    """Con tema: Thommy pide repetir frases modelo, evalúa el intento y pasa a la siguiente."""
    r = client.post("/session/start", json={"student_id": "lesson-student", "level": "A1", "lesson": LESSON})
    assert r.status_code == 200, r.text
    start = r.json()
    assert start["phrase"] == "Hi, let me introduce myself."
    assert start["topic"] == "Introducing yourself"
    print("\nTHOMMY:", start["greeting"], "|", start["phrase"])
    sid = start["session_id"]

    # 1) Dice la frase completa -> evaluación de frase al 100 % y siguiente frase
    r = client.post("/conversation/text", json={"session_id": sid, "message": "Hi, let me introduce myself.",
                                                "include_audio": False})
    body = r.json()
    assert body["evaluation"]["kind"] == "phrase"
    assert body["evaluation"]["score"] == 100 and body["evaluation"]["level"] == "excelente"
    assert body["phrase"] == "I am friendly and funny."
    assert body["timings"]["language_model_ms"] is None  # respuesta rápida, sin modelo
    print("THOMMY:", body["reply"], "|", body["phrase"])

    # 2) Se le escapa una palabra -> la marca para practicar y pide repetir la misma frase
    r = client.post("/conversation/text", json={"session_id": sid, "message": "I am friendly and fun.",
                                                "include_audio": False})
    body = r.json()
    words = {w["text"]: w["ok"] for w in body["evaluation"]["words"]}
    assert words["funny."] is False and words["friendly"] is True
    assert body["evaluation"]["level"] in ("bien", "practicar")
    print("THOMMY:", body["reply"], "|", body["phrase"], "|", body["evaluation"]["message_es"])

    # 3) Habla de otra cosa -> conversación (gramática) y Thommy vuelve a proponer una frase
    r = client.post("/conversation/text", json={"session_id": sid, "message": "I like playing football with my brother.",
                                                "include_audio": False})
    body = r.json()
    assert body["evaluation"]["kind"] == "grammar"
    assert body["phrase"]
    print("THOMMY:", body["reply"], "|", body["phrase"])


def test_audio_message_full_pipeline(client, session, student_wav):
    with student_wav.open("rb") as f:
        r = client.post("/conversation/audio", data={"session_id": session["session_id"]},
                        files={"audio": ("student.wav", f, "audio/wav")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "yesterday" in body["transcription"].lower()
    assert body["reply"]
    assert body["timings"]["speech_to_text_ms"] > 0
    audio = client.get(body["audio"]["url"])
    assert audio.status_code == 200
    _assert_wav(audio.content)
    print("\nSTUDENT (audio):", body["transcription"], "\nTHOMMY:", body["reply"], "\nTIMINGS:", body["timings"])


def test_progress(client, session):
    r = client.get(f"/session/{session['session_id']}/progress")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "active"
    assert body["student_turns"] == 2
    assert body["audio_turns"] == 1
    assert [t["role"] for t in body["history"]][:3] == ["thommy", "student", "thommy"]


def test_end_session(client, session):
    r = client.post("/session/end", json={"session_id": session["session_id"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ended"
    assert body["summary"]["summary"]
    print("\nSUMMARY:", body["summary"])
    # La sesión finalizada ya no acepta mensajes.
    r = client.post("/conversation/text", json={"session_id": session["session_id"], "message": "Hello"})
    assert r.status_code == 409 and r.json()["error"] == "session_ended"
    assert client.get(f"/session/{session['session_id']}/progress").json()["status"] == "ended"


# --- Validaciones / errores ------------------------------------------------
def test_unknown_session(client):
    r = client.post("/conversation/text", json={"session_id": "f" * 32, "message": "hi"})
    assert r.status_code == 404 and r.json()["error"] == "session_not_found"


def test_invalid_level(client):
    r = client.post("/session/start", json={"student_id": "x", "level": "Z9"})
    assert r.status_code == 422


def test_rejects_bad_extension_and_garbage(client):
    sid = client.post("/session/start", json={"student_id": "val", "level": "B1"}).json()["session_id"]
    r = client.post("/conversation/audio", data={"session_id": sid},
                    files={"audio": ("evil.exe", b"MZ\x00\x00", "application/octet-stream")})
    assert r.status_code == 400 and r.json()["error"] == "invalid_audio"
    r = client.post("/conversation/audio", data={"session_id": sid},
                    files={"audio": ("fake.wav", b"this is not audio at all", "audio/wav")})
    assert r.status_code == 400 and r.json()["error"] == "invalid_audio"


def test_silence_is_reported_as_not_understood(client, tmp_path):
    sid = client.post("/session/start", json={"student_id": "val2", "level": "B1"}).json()["session_id"]
    silent = tmp_path / "silence.wav"
    with wave.open(str(silent), "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(16000)
        w.writeframes(b"\x00\x00" * 16000 * 2)
    with silent.open("rb") as f:
        r = client.post("/conversation/audio", data={"session_id": sid},
                        files={"audio": ("silence.wav", f, "audio/wav")})
    assert r.status_code == 422 and r.json()["error"] == "speech_not_recognized", r.text


def test_audio_path_traversal_blocked(client):
    assert client.get("/audio/..%2F..%2Fconfig/settings.py").status_code == 404
    assert client.get("/audio/" + "a" * 32 + "/..%5C..%5Cmain.py").status_code == 404
