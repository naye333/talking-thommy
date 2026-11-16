"""Generación de voz (Text-to-Speech) con Piper en CPU.

Las voces son pares `<voz>.onnx` + `<voz>.onnx.json` dentro de `models/piper/`.
Para cambiar la voz: descargar otra voz a esa carpeta y cambiar PIPER_VOICE en `.env`
(o enviar `voice` al iniciar sesión).
"""
from __future__ import annotations

import base64
import logging
import re
import subprocess
import sys
import threading
import time
import wave
from dataclasses import dataclass
from pathlib import Path

from config.settings import Settings
from services.errors import EngineUnavailableError, InvalidVoiceError

log = logging.getLogger(__name__)
_NO_WINDOW = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
_VOICE_NAME_RE = re.compile(r"^[A-Za-z0-9_\-]+$")


@dataclass
class SpeechAudio:
    path: Path
    sample_rate: int
    duration_seconds: float
    voice: str
    elapsed_ms: int

    def as_base64(self) -> str:
        return base64.b64encode(self.path.read_bytes()).decode("ascii")

    @property
    def format(self) -> str:
        return "mp3" if self.path.suffix.lower() == ".mp3" else "wav"

    @property
    def mime_type(self) -> str:
        return "audio/mpeg" if self.format == "mp3" else "audio/wav"


class TextToSpeech:
    def __init__(self, settings: Settings):
        self.s = settings
        self._voices: dict = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------- voces
    def available_voices(self) -> list[str]:
        d = self.s.piper_voices_dir
        if not d.exists():
            return []
        return sorted(p.name[: -len(".onnx")] for p in d.glob("*.onnx") if (d / f"{p.name}.json").exists())

    def resolve_voice(self, name: str | None) -> str:
        name = name or self.s.piper_voice
        if not _VOICE_NAME_RE.match(name) or name not in self.available_voices():
            raise InvalidVoiceError(f"Voice '{name}' is not installed. Leave 'voice' empty to use the default. "
                                    f"Available: {self.available_voices()}")
        return name

    def _load(self, name: str):
        with self._lock:
            if name not in self._voices:
                try:
                    from piper import PiperVoice  # import tardío: carga onnxruntime solo si hace falta
                except ImportError as e:
                    raise EngineUnavailableError("piper-tts is not installed.") from e
                model = self.s.piper_voices_dir / f"{name}.onnx"
                t0 = time.perf_counter()
                self._voices[name] = PiperVoice.load(model, config_path=model.with_suffix(".onnx.json"))
                log.info("Piper voice %s loaded in %d ms", name, int((time.perf_counter() - t0) * 1000))
            return self._voices[name]

    def check(self) -> dict:
        voices = self.available_voices()
        return {"ok": self.s.piper_voice in voices, "default_voice": self.s.piper_voice, "voices": voices}

    # ------------------------------------------------------------ síntesis
    def synthesize(self, text: str, out_path: Path, voice: str | None = None,
                   length_scale: float | None = None) -> SpeechAudio:
        """Genera el audio. La extensión de `out_path` (.wav o .mp3) define el formato final.

        Voz infantil (`piper_pitch` > 1): Piper habla `pitch` veces más despacio y luego el audio se
        reproduce `pitch` veces más rápido (se cambia la frecuencia de muestreo del WAV). Resultado: tono y
        formantes más agudos con la velocidad normal, sin filtros (medido: ~30 % más rápido que asetrate+atempo).
        """
        from piper import SynthesisConfig

        name = self.resolve_voice(voice)
        piper_voice = self._load(name)
        pitch = self.s.piper_pitch
        cfg = SynthesisConfig(length_scale=(length_scale or self.s.piper_length_scale) * pitch)
        text = _speakable(text)
        t0 = time.perf_counter()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        to_mp3 = out_path.suffix.lower() == ".mp3"
        raw_path = out_path.with_suffix(".raw.wav")
        wav_path = out_path.with_suffix(".tmp.wav") if to_mp3 else out_path
        try:
            with self._lock, wave.open(str(raw_path), "wb") as wav:
                piper_voice.synthesize_wav(text, wav, syn_config=cfg)
            with wave.open(str(raw_path), "rb") as src, wave.open(str(wav_path), "wb") as dst:
                rate = int(round(src.getframerate() * pitch))
                dst.setnchannels(src.getnchannels())
                dst.setsampwidth(src.getsampwidth())
                dst.setframerate(rate)
                frames = src.readframes(src.getnframes())
                dst.writeframes(frames)
                duration = src.getnframes() / float(rate)
            if to_mp3:
                self._encode_mp3(wav_path, out_path)
        except EngineUnavailableError:
            out_path.unlink(missing_ok=True)
            raise
        except Exception as e:  # noqa: BLE001
            out_path.unlink(missing_ok=True)
            log.exception("Piper synthesis failed")
            raise EngineUnavailableError("Speech synthesis failed.") from e
        finally:
            raw_path.unlink(missing_ok=True)
            if to_mp3:
                wav_path.unlink(missing_ok=True)
        elapsed = int((time.perf_counter() - t0) * 1000)
        log.info("TTS %d chars -> %.1fs audio (%s, pitch %.2f) in %d ms", len(text), duration,
                 out_path.suffix, pitch, elapsed)
        return SpeechAudio(path=out_path, sample_rate=rate, duration_seconds=round(duration, 2),
                           voice=name, elapsed_ms=elapsed)

    def _encode_mp3(self, src: Path, dst: Path) -> None:
        # MP3 a 64 kbps mono: ~8 KB por segundo, se reproduce en Android, iOS y cualquier navegador.
        cmd = [self.s.ffmpeg_bin, "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
               "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", str(dst)]
        try:
            r = subprocess.run(cmd, capture_output=True, timeout=60, creationflags=_NO_WINDOW)
        except (FileNotFoundError, subprocess.TimeoutExpired) as e:
            raise EngineUnavailableError("ffmpeg is required for MP3 output (or set AUDIO_FORMAT=wav).") from e
        if r.returncode != 0 or not dst.exists():
            log.error("ffmpeg MP3 encoding failed: %s", r.stderr.decode("utf-8", "ignore")[-300:])
            raise EngineUnavailableError("Audio encoding failed.")


def _speakable(text: str) -> str:
    """Quita marcas que suenan mal al leerse (markdown, emojis, comillas tipográficas)."""
    text = re.sub(r"[*_#`~>|]", "", text)
    text = re.sub(r"[\U0001F000-\U0001FAFF☀-➿]", "", text)
    text = text.replace("“", '"').replace("”", '"').replace("’", "'")
    return re.sub(r"\s+", " ", text).strip() or "Sorry, could you say that again?"
