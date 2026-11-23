"""Gestión de sesiones de conversación.

Las sesiones viven en memoria y se guardan como JSON en `storage/sessions/` para que
sobrevivan a un reinicio del servidor. Para varios servidores en producción, sustituir
`SessionStore` por una implementación con Redis o base de datos (misma interfaz).
"""
from __future__ import annotations

import json
import logging
import re
import secrets
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

from config.settings import Settings
from services.errors import SessionEndedError, SessionNotFoundError

log = logging.getLogger(__name__)
_SESSION_ID_RE = re.compile(r"^[a-f0-9]{32}$")


def now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class TurnRecord:
    index: int
    role: str  # "student" | "thommy"
    text: str
    timestamp: str
    source: str = "text"  # "audio" | "text" | "system"
    correction: dict | None = None


@dataclass
class Session:
    session_id: str
    student_id: str
    level: str
    topic: str
    learning_goal: str
    voice: str
    student_name: str | None = None
    status: str = "active"
    started_at: str = field(default_factory=lambda: now().isoformat())
    last_activity_at: str = field(default_factory=lambda: now().isoformat())
    ended_at: str | None = None
    turns: list[TurnRecord] = field(default_factory=list)
    summary: dict | None = None
    # Práctica de un tema del syllabus: frases modelo en orden y la frase que se pidió decir.
    lesson: dict | None = None
    phrase_index: int = 0
    target_phrase: str | None = None
    attempts: int = 0  # intentos de la frase actual

    @property
    def model_phrases(self) -> list[str]:
        return list((self.lesson or {}).get("model_phrases") or [])

    # ---- utilidades -----------------------------------------------------
    def add_turn(self, role: str, text: str, source: str = "text", correction: dict | None = None) -> TurnRecord:
        t = TurnRecord(index=len(self.turns), role=role, text=text, timestamp=now().isoformat(),
                       source=source, correction=correction)
        self.turns.append(t)
        self.last_activity_at = t.timestamp
        return t

    @property
    def student_turns(self) -> list[TurnRecord]:
        return [t for t in self.turns if t.role == "student"]

    @property
    def student_word_count(self) -> int:
        return sum(len(t.text.split()) for t in self.student_turns)

    @property
    def corrections(self) -> list[dict]:
        return [t.correction for t in self.turns if t.correction]

    def duration_seconds(self) -> int:
        start = datetime.fromisoformat(self.started_at)
        end = datetime.fromisoformat(self.ended_at) if self.ended_at else now()
        return max(0, int((end - start).total_seconds()))

    def llm_history(self, max_messages: int) -> list[dict]:
        msgs = [{"role": "user" if t.role == "student" else "assistant", "content": t.text}
                for t in self.turns if t.source != "system" or t.role == "thommy"]
        return msgs[-max_messages:] if max_messages > 0 else msgs

    @classmethod
    def from_dict(cls, d: dict) -> "Session":
        turns = [TurnRecord(**t) for t in d.pop("turns", [])]
        return cls(**d, turns=turns)


class SessionStore:
    def __init__(self, settings: Settings):
        self.s = settings
        self._sessions: dict[str, Session] = {}
        self._lock = threading.RLock()

    # ---- persistencia ---------------------------------------------------
    def _path(self, session_id: str) -> Path:
        if not _SESSION_ID_RE.match(session_id):  # evita rutas manipuladas (../ etc.)
            raise SessionNotFoundError("Session not found.")
        return self.s.sessions_dir / f"{session_id}.json"

    def save(self, session: Session) -> None:
        with self._lock:
            path = self._path(session.session_id)
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(asdict(session), ensure_ascii=False, indent=2), encoding="utf-8")
            tmp.replace(path)

    # ---- API --------------------------------------------------------------
    def create(self, **kw) -> Session:
        sid = secrets.token_hex(16)
        session = Session(session_id=sid, **kw)
        with self._lock:
            self._sessions[sid] = session
            self.save(session)
        log.info("Session %s started (student=%s level=%s)", sid, session.student_id, session.level)
        return session

    def get(self, session_id: str) -> Session:
        with self._lock:
            if session_id in self._sessions:
                return self._sessions[session_id]
            path = self._path(session_id)
            if not path.exists():
                raise SessionNotFoundError("Session not found.")
            session = Session.from_dict(json.loads(path.read_text(encoding="utf-8")))
            self._sessions[session_id] = session
            return session

    def get_active(self, session_id: str) -> Session:
        session = self.get(session_id)
        if session.status != "active":
            raise SessionEndedError("This session has already ended. Start a new one.")
        return session

    def end(self, session: Session, summary: dict) -> Session:
        with self._lock:
            session.status = "ended"
            session.ended_at = now().isoformat()
            session.summary = summary
            self.save(session)
        log.info("Session %s ended (%d student turns)", session.session_id, len(session.student_turns))
        return session

    def expire_idle(self) -> list[str]:
        """Marca como finalizadas las sesiones inactivas y las libera de memoria."""
        limit = now() - timedelta(minutes=self.s.session_timeout_minutes)
        expired = []
        with self._lock:
            for sid, sess in list(self._sessions.items()):
                if datetime.fromisoformat(sess.last_activity_at) < limit:
                    if sess.status == "active":
                        sess.status = "ended"
                        sess.ended_at = now().isoformat()
                        self.save(sess)
                    del self._sessions[sid]
                    expired.append(sid)
        if expired:
            log.info("Expired idle sessions: %s", expired)
        return expired
