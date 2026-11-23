"""Esquemas (contratos JSON) de la API de Talking Thommy."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class CEFRLevel(str, Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


_SAFE_TEXT = Field(min_length=1, max_length=200)


class Lesson(BaseModel):
    """Tema del syllabus que se practica en la sesión (lo envía el backend de la app)."""
    title: str = Field(min_length=1, max_length=200, examples=["Introducing yourself"])
    objective: str | None = Field(default=None, max_length=500)
    grammar: list[str] = Field(default_factory=list, max_length=20)
    vocabulary: list[str] = Field(default_factory=list, max_length=40)
    model_phrases: list[str] = Field(default_factory=list, max_length=20,
                                     description="Frases que Thommy pide repetir, en orden.")

    @field_validator("model_phrases")
    @classmethod
    def _clean_phrases(cls, v: list[str]) -> list[str]:
        return [p.strip() for p in v if isinstance(p, str) and p.strip()][:20]


# ---------------------------------------------------------------------------
# Peticiones
# ---------------------------------------------------------------------------
class SessionStartRequest(BaseModel):
    student_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.\-@]+$",
                            examples=["student-001"])
    level: CEFRLevel = Field(examples=["A2"])
    topic: str = Field(default="daily life", min_length=1, max_length=200, examples=["my weekend"])
    learning_goal: str = Field(default="Practice everyday conversation", min_length=1, max_length=300,
                               examples=["Use the past simple to talk about last weekend"])
    student_name: str | None = Field(default=None, max_length=60, examples=["Ana"])
    voice: str | None = Field(default=None, max_length=80,
                              description="Voz de Piper (opcional). Omitir o null = la voz por defecto.")
    lesson: Lesson | None = Field(default=None,
                                  description="Tema del syllabus. Con frases modelo, Thommy guía la práctica de "
                                              "frases; sin tema, es conversación libre.")
    include_audio_base64: bool = Field(default=False,
                                       description="Si es true, el audio del saludo también se devuelve en base64.")

    # Ejemplo completo y VÁLIDO para Swagger (sin esto, Swagger rellena "voice": "string" y falla).
    model_config = {"json_schema_extra": {"examples": [{
        "student_id": "student-001", "level": "A2", "topic": "my weekend",
        "learning_goal": "Use the past simple to talk about last weekend", "student_name": "Ana",
    }]}}

    @field_validator("voice")
    @classmethod
    def _blank_voice(cls, v: str | None) -> str | None:
        return v.strip() or None if isinstance(v, str) else v

    @field_validator("topic", "learning_goal", "student_name")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return v.strip() if isinstance(v, str) else v


class TextMessageRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=64,
                            description="El session_id que devolvió /session/start")
    message: str = Field(min_length=1, max_length=1000, examples=["Yesterday I go to the school."])
    include_audio: bool = Field(default=True, description="Generar audio de la respuesta con Piper.")
    include_audio_base64: bool = False

    model_config = {"json_schema_extra": {"examples": [{
        "session_id": "PEGUE-AQUI-EL-SESSION-ID", "message": "Yesterday I go to the school.",
        "include_audio": True,
    }]}}


class SessionEndRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=64,
                            description="El session_id que devolvió /session/start")

    model_config = {"json_schema_extra": {"examples": [{"session_id": "PEGUE-AQUI-EL-SESSION-ID"}]}}


# ---------------------------------------------------------------------------
# Piezas de respuesta
# ---------------------------------------------------------------------------
class Correction(BaseModel):
    original: str
    corrected: str
    explanation: str = ""


class AudioInfo(BaseModel):
    url: str = Field(description="Ruta relativa para descargar el audio: GET {url}")
    format: Literal["wav", "mp3"] = "mp3"
    mime_type: str = Field(default="audio/mpeg", description="Tipo MIME, p. ej. para un data URI")
    sample_rate: int
    duration_seconds: float
    voice: str
    base64: str | None = None


class EvaluatedWord(BaseModel):
    text: str = Field(description="Palabra tal como se muestra (con su puntuación)")
    ok: bool
    hint_es: str | None = Field(default=None, description="Sugerencia en español si ok=false")


class Evaluation(BaseModel):
    """Resultado del turno para mostrar al estudiante.

    kind="phrase": se compara lo que entendió Whisper con la frase que Thommy pidió repetir. Mide si el
    sistema entendió cada palabra (inteligibilidad), NO es un análisis fonético: Whisper puede "corregir"
    palabras mal pronunciadas, así que el puntaje puede ser generoso.
    kind="grammar": conversación libre; se evalúa la gramática de lo que dijo el estudiante.
    """
    kind: Literal["phrase", "grammar"]
    label_es: str = Field(description="Nombre del puntaje para la interfaz, p. ej. 'Palabras entendidas'")
    score: int = Field(ge=0, le=100)
    level: Literal["excelente", "bien", "practicar"]
    message_es: str
    words: list[EvaluatedWord]
    target_phrase: str | None = None


class PronunciationFeedback(BaseModel):
    """Reservado para un evaluador fonético futuro. Hoy siempre `available=false`."""
    available: bool = False
    score: float | None = None
    details: list[dict] = Field(default_factory=list)
    note: str = "Pronunciation is not evaluated from transcripts."


class Timings(BaseModel):
    speech_to_text_ms: int | None = None
    grammar_check_ms: int | None = None
    language_model_ms: int | None = None
    text_to_speech_ms: int | None = None
    total_ms: int


class Turn(BaseModel):
    index: int
    role: Literal["student", "thommy"]
    text: str
    timestamp: datetime
    source: Literal["audio", "text", "system"] = "text"
    correction: Correction | None = None


# ---------------------------------------------------------------------------
# Respuestas
# ---------------------------------------------------------------------------
class SessionStartResponse(BaseModel):
    session_id: str
    student_id: str
    level: CEFRLevel
    topic: str
    learning_goal: str
    voice: str
    greeting: str
    phrase: str | None = Field(default=None, description="Frase que el estudiante debe decir (práctica de tema)")
    audio: AudioInfo | None = Field(description="Audio de greeting + phrase")
    created_at: datetime


class ConversationResponse(BaseModel):
    session_id: str
    turn: int = Field(description="Número de intervención del estudiante en esta sesión")
    transcription: str = Field(description="Lo que dijo/escribió el estudiante")
    reply: str = Field(description="Respuesta de Thommy (texto que también se habla)")
    phrase: str | None = Field(default=None, description="Siguiente frase a practicar (si hay tema)")
    correction: Correction | None
    evaluation: Evaluation
    audio: AudioInfo | None = Field(description="Audio de reply + phrase")
    pronunciation: PronunciationFeedback
    timings: Timings


class SessionProgressResponse(BaseModel):
    session_id: str
    student_id: str
    level: CEFRLevel
    topic: str
    learning_goal: str
    status: Literal["active", "ended"]
    started_at: datetime
    last_activity_at: datetime
    duration_seconds: int
    student_turns: int
    student_words: int
    audio_turns: int
    corrections: list[Correction]
    history: list[Turn]
    practice_summary: str
    feedback_available: bool


class SessionSummary(BaseModel):
    summary: str
    strengths: list[str]
    areas_to_improve: list[str]
    corrections: list[Correction]
    vocabulary: list[str]
    next_steps: list[str]
    pronunciation: PronunciationFeedback


class SessionEndResponse(BaseModel):
    session_id: str
    status: Literal["ended"]
    duration_seconds: int
    student_turns: int
    student_words: int
    summary: SessionSummary


class ErrorResponse(BaseModel):
    error: str
    detail: str


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    components: dict[str, dict]
