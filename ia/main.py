"""IA Talking Thommy — API del módulo de inteligencia artificial y voz.

Arranque:  .venv\\Scripts\\python.exe main.py      (o)  uvicorn main:app --host 127.0.0.1 --port 8000
Swagger:   http://127.0.0.1:8000/docs
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from logging.handlers import RotatingFileHandler

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.dependencies import get_store, get_tutor
from api.routes import conversations, sessions
from config.settings import PROJECT_ROOT, get_settings
from models.schemas import HealthResponse
from services.cleanup import cleanup_loop
from services.errors import ThommyError

settings = get_settings()


def _setup_logging() -> None:
    log_dir = PROJECT_ROOT / "logs"
    log_dir.mkdir(exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
    file_handler = RotatingFileHandler(log_dir / "thommy.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    file_handler.setFormatter(fmt)
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    root = logging.getLogger()
    root.setLevel(settings.log_level.upper())
    root.handlers = [console, file_handler]


_setup_logging()
log = logging.getLogger("thommy")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting %s (model=%s, voice=%s)", settings.app_name, settings.ollama_model, settings.piper_voice)
    task = asyncio.create_task(cleanup_loop(settings, get_store()))
    if settings.warm_up_on_start:
        # En segundo plano: el servidor acepta peticiones mientras carga los modelos.
        asyncio.get_running_loop().run_in_executor(None, get_tutor().warm_up)
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task
    get_tutor().llm.close()


app = FastAPI(
    title="IA Talking Thommy API",
    version="1.0.0",
    description=(
        "Módulo de IA y voz del tutor de inglés **Talking Thommy** (listening & speaking).\n\n"
        f"Flujo: audio del estudiante → Whisper.cpp → Ollama ({settings.ollama_model}) → Piper → "
        "texto + audio de Thommy.\n\n"
        "Si `API_KEY` está configurada, envíe la cabecera `X-API-Key`."
    ),
    lifespan=lifespan,
)

origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials="*" not in origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)


@app.exception_handler(ThommyError)
async def thommy_error_handler(request: Request, exc: ThommyError):
    level = logging.ERROR if exc.status_code >= 500 else logging.INFO
    log.log(level, "%s %s -> %s: %s", request.method, request.url.path, exc.code, exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"error": exc.code, "detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    errors = "; ".join(f"{'.'.join(str(x) for x in e['loc'])}: {e['msg']}" for e in exc.errors())
    return JSONResponse(status_code=422, content={"error": "validation_error", "detail": errors})


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"error": "internal_error", "detail": "Unexpected server error."})


@app.get("/health", response_model=HealthResponse, tags=["System"], summary="Estado de los motores")
async def health():
    tutor = get_tutor()
    components = {
        "language_model": await asyncio.to_thread(tutor.llm.check),
        "speech_to_text": tutor.stt.check(),
        "text_to_speech": tutor.tts.check(),
    }
    ok = all(c.get("ok") for c in components.values())
    return HealthResponse(status="ok" if ok else "degraded", components=components)


app.include_router(sessions.router)
app.include_router(conversations.router)
app.include_router(conversations.audio_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, log_level=settings.log_level.lower())
