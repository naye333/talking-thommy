"""Rutas de conversación: por audio (flujo completo) y por texto (pruebas sin micrófono)."""
import re

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse

from api.dependencies import get_tutor, require_api_key, save_upload_safely
from config.settings import Settings, get_settings
from models.schemas import ConversationResponse, ErrorResponse, TextMessageRequest
from services.errors import SessionNotFoundError
from services.tutor import Tutor

router = APIRouter(tags=["Conversation"], dependencies=[Depends(require_api_key)],
                   responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse},
                              409: {"model": ErrorResponse}, 413: {"model": ErrorResponse},
                              422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}})

_SID = re.compile(r"^[a-f0-9]{32}$")
_FILE = re.compile(r"^\d{3}-[a-f0-9]{8}\.(wav|mp3)$")
_MEDIA = {"wav": "audio/wav", "mp3": "audio/mpeg"}


@router.post("/conversation/audio", response_model=ConversationResponse,
             summary="Enviar audio del estudiante (Whisper → Ollama → Piper)")
async def conversation_audio(
    session_id: str = Form(..., min_length=8, max_length=64),
    audio: UploadFile = File(..., description="Grabación del estudiante (wav, mp3, m4a, webm, ogg, flac)"),
    include_audio_base64: bool = Form(False),
    tutor: Tutor = Depends(get_tutor),
    settings: Settings = Depends(get_settings),
):
    tutor.store.get_active(session_id)  # falla rápido antes de guardar el archivo
    path = await save_upload_safely(audio, settings)
    try:
        return await run_in_threadpool(tutor.handle_audio, session_id, path, include_audio_base64)
    finally:
        if not settings.keep_student_audio:
            path.unlink(missing_ok=True)


@router.post("/conversation/text", response_model=ConversationResponse,
             summary="Enviar un mensaje de texto (sin micrófono)")
async def conversation_text(req: TextMessageRequest, tutor: Tutor = Depends(get_tutor)):
    return await run_in_threadpool(tutor.handle_text, req.session_id, req.message, req.include_audio,
                                   req.include_audio_base64)


# Sin API key a propósito: el frontend puede usar la URL directamente en <audio src="...">.
# La URL contiene el id de sesión (128 bits aleatorios) + un sufijo aleatorio, así que no es adivinable.
audio_router = APIRouter(tags=["Conversation"])


@audio_router.get("/audio/{session_id}/{filename}", response_class=FileResponse,
                  summary="Descargar audio de Thommy",
                  responses={200: {"content": {"audio/mpeg": {}, "audio/wav": {}}}})
async def get_audio(session_id: str, filename: str, settings: Settings = Depends(get_settings)):
    # Solo nombres generados por el servidor: imposible salir de storage/audio.
    if not _SID.match(session_id) or not _FILE.match(filename):
        raise SessionNotFoundError("Audio not found.")
    path = settings.audio_dir / session_id / filename
    if not path.is_file():
        raise SessionNotFoundError("Audio not found or expired.")
    # "inline": el navegador lo reproduce directamente en vez de descargarlo.
    return FileResponse(path, media_type=_MEDIA[filename.rsplit(".", 1)[1]], filename=filename,
                        content_disposition_type="inline")
