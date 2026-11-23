"""Reconocimiento de voz (Speech-to-Text) con whisper.cpp en CPU.

Flujo: audio subido (wav/mp3/webm/…) → ffmpeg → WAV 16 kHz mono → whisper-cli → texto.
"""
from __future__ import annotations

import logging
import math
import re
from array import array
import shutil
import subprocess
import sys
import time
import uuid
import wave
from dataclasses import dataclass
from pathlib import Path

from config.settings import Settings
from services.errors import EngineUnavailableError, InvalidAudioError, UnintelligibleAudioError

log = logging.getLogger(__name__)

_NO_WINDOW = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
# Marcas que Whisper emite cuando no hay voz reconocible.
_NOISE_TAGS = re.compile(r"\[[^\]]*\]|\([^)]*\)|\*[^*]*\*")


def _dbfs(peak: int) -> float:
    return 20 * math.log10(peak / 32768) if peak > 0 else -120.0


@dataclass
class Transcription:
    text: str
    duration_seconds: float
    elapsed_ms: int


class SpeechToText:
    def __init__(self, settings: Settings):
        self.s = settings

    # ------------------------------------------------------------------ util
    def check(self) -> dict:
        ffmpeg = shutil.which(self.s.ffmpeg_bin) or (self.s.ffmpeg_bin if Path(self.s.ffmpeg_bin).exists() else None)
        ok = self.s.whisper_bin.exists() and self.s.whisper_model.exists() and bool(ffmpeg)
        return {
            "ok": ok,
            "whisper_bin": self.s.whisper_bin.exists(),
            "model": self.s.whisper_model.name if self.s.whisper_model.exists() else None,
            "ffmpeg": bool(ffmpeg),
        }

    def _run(self, cmd: list[str], timeout: float, what: str) -> subprocess.CompletedProcess:
        try:
            return subprocess.run(cmd, capture_output=True, timeout=timeout, creationflags=_NO_WINDOW)
        except FileNotFoundError as e:
            raise EngineUnavailableError(f"{what} not found: {cmd[0]}") from e
        except subprocess.TimeoutExpired as e:
            raise EngineUnavailableError(f"{what} timed out after {timeout:.0f}s") from e

    # ------------------------------------------------------------ conversión
    def to_wav16k(self, src: Path, dst: Path) -> float:
        """Convierte cualquier audio soportado por ffmpeg a WAV PCM 16 kHz mono. Devuelve la duración."""
        cmd = [
            self.s.ffmpeg_bin, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(src),
            "-t", str(self.s.max_audio_seconds + 1),  # nunca procesar más de lo permitido
            "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(dst),
        ]
        r = self._run(cmd, timeout=60, what="ffmpeg")
        if r.returncode != 0 or not dst.exists():
            err = r.stderr.decode("utf-8", "ignore").strip().splitlines()
            log.warning("ffmpeg rejected audio: %s", err[-1:] if err else "unknown")
            raise InvalidAudioError("The file could not be decoded as audio.")
        try:
            with wave.open(str(dst), "rb") as w:
                n = w.getnframes()
                duration = n / float(w.getframerate())
                samples = array("h", w.readframes(n))
        except wave.Error as e:
            raise InvalidAudioError("Converted audio is not valid.") from e

        if duration < self.s.min_audio_seconds:
            raise InvalidAudioError(f"Audio is too short ({duration:.2f}s). Minimum is {self.s.min_audio_seconds}s.")
        if duration > self.s.max_audio_seconds + 0.5:
            raise InvalidAudioError(f"Audio is too long. Maximum is {self.s.max_audio_seconds:.0f}s.")
        # Whisper "alucina" palabras (p. ej. "you") con audio en silencio: se detecta antes por energía.
        peak_db = _dbfs(max((abs(x) for x in samples), default=0))
        if peak_db < self.s.silence_peak_dbfs:
            log.info("Audio rejected as silence (peak %.1f dBFS)", peak_db)
            raise UnintelligibleAudioError(
                "No voice detected in the recording. Please check the microphone and speak a little louder."
            )
        return duration

    # ---------------------------------------------------------- transcribir
    def transcribe(self, audio_path: Path, context: str | None = None) -> Transcription:
        """Transcribe el audio. `context` (lo último que dijo Thommy, vocabulario del tema) se le da a Whisper
        como prompt inicial: con acento no nativo mejora mucho palabras como "yellow" vs "jelly"."""
        if not self.s.whisper_bin.exists() or not self.s.whisper_model.exists():
            raise EngineUnavailableError("Whisper.cpp binary or model is missing. See README.")

        t0 = time.perf_counter()
        work = self.s.tmp_dir / f"stt-{uuid.uuid4().hex}"
        wav = work.with_suffix(".wav")
        txt = work.with_suffix(".txt")
        try:
            duration = self.to_wav16k(audio_path, wav)
            if self.s.stt_samples_dir:  # solo para evaluar modelos con voces reales (desactivado por defecto)
                self.s.stt_samples_dir.mkdir(parents=True, exist_ok=True)
                shutil.copy(wav, self.s.stt_samples_dir / f"{time.strftime('%Y%m%d-%H%M%S')}-{wav.name}")
            cmd = [
                str(self.s.whisper_bin),
                "-m", str(self.s.whisper_model),
                "-f", str(wav),
                "-l", "en",
                "-t", str(self.s.whisper_threads),
                "-nt", "-np",          # sin marcas de tiempo, sin logs
                "-sns",                # suprimir tokens que no son habla ([music], etc.)
                "-otxt", "-of", str(work),
            ]
            if context:
                cmd += ["--prompt", context[:400]]
            r = self._run(cmd, timeout=self.s.whisper_timeout_s, what="whisper-cli")
            if r.returncode != 0 or not txt.exists():
                log.error("whisper-cli failed (%s): %s", r.returncode, r.stderr.decode("utf-8", "ignore")[-500:])
                raise EngineUnavailableError("Speech recognition failed.")
            raw = txt.read_text(encoding="utf-8", errors="ignore")
        finally:
            for p in (wav, txt):
                p.unlink(missing_ok=True)

        text = self.clean(raw)
        if not text:
            raise UnintelligibleAudioError(
                "Thommy could not understand the audio. Please speak a little louder and closer to the microphone."
            )
        elapsed = int((time.perf_counter() - t0) * 1000)
        log.info("STT %.1fs audio -> %d chars in %d ms", duration, len(text), elapsed)
        return Transcription(text=text, duration_seconds=round(duration, 2), elapsed_ms=elapsed)

    @staticmethod
    def clean(raw: str) -> str:
        text = _NOISE_TAGS.sub(" ", raw)
        text = re.sub(r"\s+", " ", text).strip()
        # Si solo quedan signos de puntuación, no hay voz.
        return text if re.search(r"[A-Za-z0-9]", text) else ""
