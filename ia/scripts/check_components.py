"""Prueba individual de cada motor (Piper, Whisper, Ollama) sin levantar la API.

Uso:  .venv\\Scripts\\python.exe scripts\\check_components.py
Genera los audios de prueba en tests/fixtures/ (necesarios para las pruebas de la API).
"""
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from config.settings import get_settings  # noqa: E402
from services.language_model import LanguageModel  # noqa: E402
from services.speech_to_text import SpeechToText  # noqa: E402
from services.text_to_speech import TextToSpeech  # noqa: E402

FIX = ROOT / "tests" / "fixtures"
FIX.mkdir(parents=True, exist_ok=True)


def main() -> int:
    s = get_settings()
    ok = True

    print("== Piper (texto a voz) ==")
    # Voz de Thommy (niño, con efecto de tono)
    tts = TextToSpeech(s)
    t0 = time.perf_counter()
    thommy = tts.synthesize("Hi! I'm Thommy! Let's practice English together!",
                            s.tmp_dir / f"thommy_check.{s.audio_format}")
    print(f"  Thommy: {thommy.duration_seconds}s audio, voice={thommy.voice}, pitch={s.piper_pitch}, "
          f"{thommy.format}, {int((time.perf_counter() - t0) * 1000)} ms (includes voice load)")
    thommy.path.unlink(missing_ok=True)

    # Audio de prueba que simula a un ESTUDIANTE: voz adulta natural, sin efecto de tono.
    student_tts = TextToSpeech(s.model_copy(update={"piper_pitch": 1.0, "piper_voice": "en_US-joe-medium"}))
    t0 = time.perf_counter()
    a = student_tts.synthesize("Yesterday I go to the school with my friends.", FIX / "student_sentence.wav")
    print(f"  {a.path.name}: {a.duration_seconds}s audio @ {a.sample_rate} Hz, voice={a.voice}, "
          f"{int((time.perf_counter() - t0) * 1000)} ms (includes voice load)")

    print("== Whisper.cpp (voz a texto) ==")
    stt = SpeechToText(s)
    for name in ("jfk.wav", "student_sentence.wav"):
        p = FIX / name
        if not p.exists():
            print(f"  (skip {name}: missing)")
            continue
        tr = stt.transcribe(p)
        print(f"  {name}: {tr.duration_seconds}s -> '{tr.text}' ({tr.elapsed_ms} ms)")

    # Conversión de formatos comprimidos típicos del navegador / móvil.
    import subprocess
    for ext, codec in (("webm", "libopus"), ("mp3", "libmp3lame")):
        out = FIX / f"student_sentence.{ext}"
        subprocess.run([s.ffmpeg_bin, "-y", "-loglevel", "error", "-i", str(FIX / "student_sentence.wav"),
                        "-c:a", codec, str(out)], check=True)
        tr = stt.transcribe(out)
        print(f"  {out.name}: -> '{tr.text}' ({tr.elapsed_ms} ms)")

    print("== Ollama (modelo de lenguaje) ==")
    llm = LanguageModel(s)
    print("  check:", llm.check())
    r = llm.chat([{"role": "user", "content": "In one sentence, greet an English student."}], max_tokens=40)
    print(f"  reply: '{r.content}' ({r.elapsed_ms} ms, {r.eval_tokens} tokens)")
    ok = ok and bool(r.content)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
