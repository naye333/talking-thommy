"""Limpieza periódica de archivos temporales, audios antiguos y sesiones inactivas."""
from __future__ import annotations

import asyncio
import logging
import shutil
import time

from config.settings import Settings
from services.session_manager import SessionStore

log = logging.getLogger(__name__)


def cleanup_once(settings: Settings, store: SessionStore) -> dict:
    now = time.time()
    removed_audio = removed_tmp = 0

    # 1) Temporales (subidas y conversiones) con más de 10 minutos: restos de errores o cortes.
    for p in settings.tmp_dir.glob("*"):
        if p.is_file() and now - p.stat().st_mtime > 600:
            p.unlink(missing_ok=True)
            removed_tmp += 1

    # 2) Audios de Thommy más antiguos que la retención configurada.
    limit = settings.audio_retention_minutes * 60
    for session_dir in settings.audio_dir.glob("*"):
        if not session_dir.is_dir():
            continue
        for f in session_dir.glob("*.wav"):
            if now - f.stat().st_mtime > limit:
                f.unlink(missing_ok=True)
                removed_audio += 1
        if not any(session_dir.iterdir()):
            shutil.rmtree(session_dir, ignore_errors=True)

    # 3) Sesiones inactivas.
    expired = store.expire_idle()
    if removed_audio or removed_tmp or expired:
        log.info("Cleanup: %d audio, %d tmp, %d sessions expired", removed_audio, removed_tmp, len(expired))
    return {"audio": removed_audio, "tmp": removed_tmp, "expired_sessions": len(expired)}


async def cleanup_loop(settings: Settings, store: SessionStore) -> None:
    while True:
        try:
            await asyncio.to_thread(cleanup_once, settings, store)
        except Exception:  # noqa: BLE001
            log.exception("Cleanup failed")
        await asyncio.sleep(settings.cleanup_interval_seconds)
