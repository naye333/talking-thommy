"""Evaluación rápida de la calidad pedagógica de Thommy (sin audio).

Uso: .venv\\Scripts\\python.exe scripts\\eval_tutor.py
Envía frases con y sin errores y muestra si Thommy corrige bien y si termina con una pregunta.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.dependencies import get_tutor  # noqa: E402
from models.schemas import CEFRLevel, SessionStartRequest  # noqa: E402

CASES = [  # (nivel, tema, frase, ¿tiene error?)
    ("A1", "food", "I likes pizza very much.", True),
    ("A1", "food", "I eat rice every day.", False),
    ("A2", "school", "Yesterday I go to the school.", True),
    ("A2", "school", "My favourite subject is history.", False),
    ("B1", "travel", "Last year I have visited Paris with my family.", True),
    ("B1", "travel", "I would love to travel to Japan one day.", False),
    ("B2", "work", "If I would have more time, I would learn to play the guitar.", True),
    ("B2", "work", "I've been working from home since the pandemic started.", False),
    ("A2", "family", "My brother don't like vegetables.", True),
    ("A2", "family", "My favourite colour is blue.", False),
    ("B1", "hobbies", "He can speaks three languages.", True),
    ("C1", "cities", "There is many people living in big cities nowadays.", True),
]


def main():
    tutor = get_tutor()
    stats = {"tp": 0, "fn": 0, "fp": 0, "tn": 0, "question": 0}
    for level, topic, text, has_error in CASES:
        s = tutor.start_session(SessionStartRequest(student_id="eval", level=CEFRLevel(level), topic=topic))
        r = tutor.handle_text(s.session_id, text, include_audio=False)
        flagged = r.correction is not None
        key = ("tp" if flagged else "fn") if has_error else ("fp" if flagged else "tn")
        stats[key] += 1
        stats["question"] += r.reply.rstrip().endswith("?")
        print(f"[{level}] {text}\n   -> {r.reply}\n   correction={r.correction.model_dump() if r.correction else None}"
              f"  [{key.upper()}] llm={r.timings.language_model_ms}ms\n")
        tutor.store.end(tutor.store.get(s.session_id), {"summary": "eval"})
    n = len(CASES)
    print(f"Errors detected: {stats['tp']}/{stats['tp'] + stats['fn']} | false corrections: {stats['fp']}/"
          f"{stats['fp'] + stats['tn']} | replies ending with a question: {stats['question']}/{n}")


if __name__ == "__main__":
    main()
