"""Rutas de sesiones: iniciar, consultar progreso y finalizar."""
from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool

from api.dependencies import get_tutor, require_api_key
from models.schemas import (
    ErrorResponse, SessionEndRequest, SessionEndResponse, SessionProgressResponse, SessionStartRequest,
    SessionStartResponse,
)
from services.tutor import Tutor

router = APIRouter(prefix="/session", tags=["Sessions"], dependencies=[Depends(require_api_key)],
                   responses={404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}})


@router.post("/start", response_model=SessionStartResponse, summary="Iniciar una sesión de práctica")
async def start_session(req: SessionStartRequest, tutor: Tutor = Depends(get_tutor)):
    """Crea la sesión y devuelve el saludo de Thommy (texto + audio)."""
    return await run_in_threadpool(tutor.start_session, req)


@router.get("/{session_id}/progress", response_model=SessionProgressResponse, summary="Progreso de la sesión")
async def session_progress(session_id: str, tutor: Tutor = Depends(get_tutor)):
    return await run_in_threadpool(tutor.progress, session_id)


@router.post("/end", response_model=SessionEndResponse, summary="Finalizar la sesión y obtener resumen")
async def end_session(req: SessionEndRequest, tutor: Tutor = Depends(get_tutor)):
    return await run_in_threadpool(tutor.end_session, req.session_id)
