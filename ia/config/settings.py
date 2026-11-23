"""Configuración central del módulo IA Talking Thommy.

Todos los valores se pueden cambiar con variables de entorno o con el archivo `.env`
(ver `.env.example`). Las rutas relativas se resuelven desde la carpeta del proyecto.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _resolve(path: Path) -> Path:
    return path if path.is_absolute() else (PROJECT_ROOT / path).resolve()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Servidor ---------------------------------------------------------
    app_name: str = "IA Talking Thommy"
    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "INFO"
    # Orígenes permitidos para CORS (separados por comas). "*" = cualquiera (solo desarrollo).
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    # Si se define, todas las rutas (excepto /health y /docs) exigen la cabecera X-API-Key.
    api_key: str = ""

    # --- Ollama (modelo de lenguaje) -------------------------------------
    ollama_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen3:1.7b"
    ollama_timeout_s: float = 120.0
    ollama_temperature: float = 0.5
    ollama_num_ctx: int = 2048
    ollama_max_tokens: int = 200
    ollama_keep_alive: str = "30m"
    # Modelos con "razonamiento" (Qwen3, etc.): false = respuesta directa (mucho más rápido en CPU).
    # Vacío = no se envía (para modelos sin esa capacidad, como qwen2.5).
    ollama_think: bool | None = False
    # Número máximo de mensajes previos (estudiante + Thommy) enviados como contexto.
    history_max_messages: int = 12

    # --- Whisper.cpp (voz a texto) ----------------------------------------
    whisper_bin: Path = Path("bin/whisper/Release/whisper-cli.exe")
    whisper_model: Path = Path("models/whisper/ggml-base.en.bin")
    whisper_threads: int = 4
    # Dar a Whisper el contexto de la conversación (pregunta de Thommy + vocabulario del tema).
    whisper_use_context: bool = True
    # Solo para evaluar modelos: si se define, guarda una copia de cada audio del estudiante aquí. Vacío = no guarda.
    stt_samples_dir: Path | None = None
    whisper_timeout_s: float = 120.0
    ffmpeg_bin: str = "ffmpeg"
    # Si el pico del audio está por debajo de este nivel se considera silencio (no se envía a Whisper).
    silence_peak_dbfs: float = -45.0

    # --- Piper (texto a voz) ----------------------------------------------
    piper_voices_dir: Path = Path("models/piper")
    # Voz de Thommy (niño): voz femenina de dominio público con el tono subido.
    piper_voice: str = "en_US-kristin-medium"
    piper_length_scale: float = 1.0  # >1 = más lento (útil para niveles A1/A2)
    # Factor de tono: 1.0 = voz original; 1.2-1.4 = voz infantil. Requiere ffmpeg.
    piper_pitch: float = Field(default=1.28, ge=0.5, le=2.0)
    # Formato del audio de Thommy: "mp3" (ligero, se reproduce en Android/iOS/navegador) o "wav".
    audio_format: Literal["mp3", "wav"] = "mp3"

    # --- Audio y almacenamiento -------------------------------------------
    max_upload_mb: float = 10.0
    min_audio_seconds: float = 0.3
    max_audio_seconds: float = 60.0
    allowed_audio_extensions: str = "wav,mp3,m4a,webm,ogg,oga,flac,mp4,aac"
    storage_dir: Path = Path("storage")
    keep_student_audio: bool = False
    audio_retention_minutes: int = 120
    session_timeout_minutes: int = 60
    cleanup_interval_seconds: int = 300

    # --- Concurrencia -----------------------------------------------------
    # En un PC de 8 GB conviene procesar una petición pesada a la vez.
    max_concurrent_pipelines: int = Field(default=1, ge=1)
    # Precargar voz y modelo al arrancar (primera respuesta más rápida).
    warm_up_on_start: bool = True

    @field_validator("whisper_bin", "whisper_model", "piper_voices_dir", "storage_dir")
    @classmethod
    def _abs(cls, v: Path) -> Path:
        return _resolve(v)

    @field_validator("stt_samples_dir", mode="before")
    @classmethod
    def _optional_dir(cls, v):
        return _resolve(Path(v)) if v not in (None, "") else None

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_extensions(self) -> set[str]:
        return {e.strip().lower().lstrip(".") for e in self.allowed_audio_extensions.split(",") if e.strip()}

    @property
    def audio_dir(self) -> Path:
        return self.storage_dir / "audio"

    @property
    def sessions_dir(self) -> Path:
        return self.storage_dir / "sessions"

    @property
    def tmp_dir(self) -> Path:
        return self.storage_dir / "tmp"

    @property
    def max_upload_bytes(self) -> int:
        return int(self.max_upload_mb * 1024 * 1024)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    for d in (s.audio_dir, s.sessions_dir, s.tmp_dir):
        d.mkdir(parents=True, exist_ok=True)
    return s
