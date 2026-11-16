"""Dependencias compartidas por las rutas: servicios únicos, API key y recepción segura de audio."""
from __future__ import annotations

import logging
import secrets
import uuid
from functools import lru_cache
from pathlib import Path

from fastapi import Depends, Header, UploadFile

from config.settings import Settings, get_settings
from services.errors import AudioTooLargeError, InvalidAudioError, ThommyError
from services.language_model import LanguageModel
from services.pronunciation import NullPronunciationEvaluator
from services.session_manager import SessionStore
from services.speech_to_text import SpeechToText
from services.text_to_speech import TextToSpeech
from services.tutor import Tutor

log = logging.getLogger(__name__)


@lru_cache
def get_store() -> SessionStore:
    return SessionStore(get_settings())


@lru_cache
def get_tutor() -> Tutor:
    s = get_settings()
    return Tutor(s, get_store(), SpeechToText(s), LanguageModel(s), TextToSpeech(s), NullPronunciationEvaluator())


class UnauthorizedError(ThommyError):
    status_code = 401
    code = "unauthorized"


def require_api_key(x_api_key: str | None = Header(default=None), settings: Settings = Depends(get_settings)) -> None:
    """Si API_KEY está configurada, exige la cabecera X-API-Key con ese valor."""
    if settings.api_key and not (x_api_key and secrets.compare_digest(x_api_key, settings.api_key)):
        raise UnauthorizedError("Missing or invalid X-API-Key header.")


async def save_upload_safely(upload: UploadFile, settings: Settings) -> Path:
    """Guarda el audio subido en storage/tmp con un nombre aleatorio, validando extensión y tamaño.

    Nunca se usa el nombre que envía el cliente como ruta (evita path traversal).
    """
    name = (upload.filename or "").lower()
    ext = Path(name).suffix.lstrip(".")
    if ext not in settings.allowed_extensions:
        raise InvalidAudioError(
            f"Unsupported audio type '.{ext or '?'}'. Allowed: {', '.join(sorted(settings.allowed_extensions))}"
        )
    dest = settings.tmp_dir / f"upload-{uuid.uuid4().hex}.{ext}"
    size = 0
    try:
        with dest.open("wb") as f:
            while chunk := await upload.read(1024 * 256):
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    raise AudioTooLargeError(f"Audio file exceeds {settings.max_upload_mb:g} MB.")
                f.write(chunk)
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    if size == 0:
        dest.unlink(missing_ok=True)
        raise InvalidAudioError("The audio file is empty.")
    return dest
