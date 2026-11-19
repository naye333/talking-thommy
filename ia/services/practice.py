"""Práctica de frases del syllabus y evaluación de cada turno.

- `evaluate_phrase`: compara lo que entendió Whisper con la frase que Thommy pidió decir.
  Mide inteligibilidad (¿el sistema reconoció cada palabra?). NO es un análisis fonético: Whisper a veces
  "corrige" palabras mal pronunciadas, así que el puntaje puede ser generoso. Queda como medida provisional
  hasta conectar un evaluador fonético (services/pronunciation.py).
- `evaluate_free`: en conversación libre evalúa la gramática a partir de la corrección del corrector.
- Frases de ánimo de Thommy (personalidad carismática) para no llamar al modelo en cada repetición.
"""
from __future__ import annotations

import random
import re
from difflib import SequenceMatcher

from models.schemas import Correction, EvaluatedWord, Evaluation

# Umbrales del puntaje (0-100)
EXCELLENT_FROM = 90
GOOD_FROM = 60
# Por debajo de esta coincidencia se asume que el estudiante no intentó la frase, sino que habló libremente.
ATTEMPT_MIN_MATCH = 0.5

_NUMBERS = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six",
            "7": "seven", "8": "eight", "9": "nine", "10": "ten", "11": "eleven", "12": "twelve"}
_CONTRACTIONS = [("n't", " not"), ("'re", " are"), ("'ve", " have"), ("'ll", " will"), ("'m", " am"),
                 ("'d", " would"), ("let's", "let us"), ("it's", "it is"), ("that's", "that is"),
                 ("what's", "what is"), ("he's", "he is"), ("she's", "she is")]


def tokens(text: str) -> list[str]:
    """Palabras normalizadas para comparar (minúsculas, sin puntuación, contracciones y números expandidos)."""
    t = text.lower().replace("’", "'").replace("can't", "cannot").replace("won't", "will not")
    for short, full in _CONTRACTIONS:
        t = t.replace(short, full)
    out = []
    for w in re.findall(r"[a-z0-9']+", t):
        w = w.strip("'")
        if w:
            out.extend(_NUMBERS.get(w, w).split())
    return out


def _display_words(phrase: str) -> list[str]:
    return phrase.split()


def _similar(a: str, b: str) -> bool:
    """Coincidencia tolerante (colour/color, friend/friends), pero no introduce/produce."""
    return a == b or (len(a) > 3 and a[0] == b[:1] and SequenceMatcher(None, a, b).ratio() >= 0.85)


def _level(score: int) -> str:
    if score >= EXCELLENT_FROM:
        return "excelente"
    return "bien" if score >= GOOD_FROM else "practicar"


def phrase_match(target: str, heard: str) -> float:
    """Fracción de palabras de la frase objetivo reconocidas en lo que se escuchó (0-1)."""
    target_t, heard_t = tokens(target), tokens(heard)
    if not target_t:
        return 0.0
    return _matched_count(target_t, heard_t) / len(target_t)


def _matched_flags(target_t: list[str], heard_t: list[str]) -> list[bool]:
    flags = [False] * len(target_t)
    for block in SequenceMatcher(None, target_t, heard_t, autojunk=False).get_matching_blocks():
        for k in range(block.size):
            flags[block.a + k] = True
    # Segunda pasada: palabras parecidas que el alineamiento exacto no emparejó.
    remaining = list(heard_t)
    for i, ok in enumerate(flags):
        if not ok and any(_similar(target_t[i], h) for h in remaining):
            flags[i] = True
    return flags


def _matched_count(target_t: list[str], heard_t: list[str]) -> int:
    return sum(_matched_flags(target_t, heard_t))


def evaluate_phrase(target: str, heard: str) -> Evaluation:
    display = _display_words(target)
    flags_by_token = _matched_flags(tokens(target), tokens(heard))
    # Llevar el resultado de los tokens a las palabras que se muestran ("Hi," "let's" -> 1 o 2 tokens).
    words: list[EvaluatedWord] = []
    cursor = 0
    for word in display:
        n = max(1, len(tokens(word)))
        ok = all(flags_by_token[cursor:cursor + n]) if flags_by_token[cursor:cursor + n] else True
        cursor += n
        clean = re.sub(r"[^A-Za-z0-9']", "", word)
        words.append(EvaluatedWord(text=word, ok=ok, hint_es=None if ok else f'Repite despacio: "{clean}"'))
    total = len(words) or 1
    score = round(100 * sum(w.ok for w in words) / total)
    missed = [re.sub(r"[^A-Za-z0-9']", "", w.text) for w in words if not w.ok]
    if not missed:
        message = "¡Thommy entendió toda la frase! Sigue así."
    elif len(missed) == 1:
        message = f'Casi perfecto. Thommy no entendió bien "{missed[0]}": repítela despacio.'
    else:
        listed = ", ".join(f'"{m}"' for m in missed[:3])
        message = f"Buen intento. Thommy no entendió bien {listed}. Repite la frase despacio."
    return Evaluation(kind="phrase", label_es="Palabras entendidas", score=score, level=_level(score),
                      message_es=message, words=words, target_phrase=target)


def evaluate_free(heard: str, correction: Correction | None) -> Evaluation:
    display = heard.split()
    if not correction:
        words = [EvaluatedWord(text=w, ok=True) for w in display]
        return Evaluation(kind="grammar", label_es="Gramática", score=100, level="excelente",
                          message_es="¡Muy bien! Tu frase fue clara y correcta.", words=words)

    heard_t, fixed_t = tokens(heard), tokens(correction.corrected)
    wrong_tokens: dict[int, str] = {}
    for op, i1, i2, j1, j2 in SequenceMatcher(None, heard_t, fixed_t, autojunk=False).get_opcodes():
        if op in ("replace", "delete"):
            replacement = " ".join(fixed_t[j1:j2])
            for i in range(i1, i2):
                wrong_tokens[i] = replacement
    words, cursor = [], 0
    for word in display:
        n = max(1, len(tokens(word)))
        bad = [wrong_tokens[i] for i in range(cursor, cursor + n) if i in wrong_tokens]
        cursor += n
        if bad:
            hint = f'Mejor di: "{bad[0]}"' if bad[0] else "Esta palabra sobra."
            words.append(EvaluatedWord(text=word, ok=False, hint_es=hint))
        else:
            words.append(EvaluatedWord(text=word, ok=True))
    ok_ratio = sum(w.ok for w in words) / (len(words) or 1)
    score = min(85, round(100 * ok_ratio))  # con un error no se llega a "excelente"
    return Evaluation(kind="grammar", label_es="Gramática", score=score, level=_level(score),
                      message_es=f'¡Buen intento! Se dice así: "{correction.corrected}"', words=words)


# ---------------------------------------------------------------- personalidad
CHEERS_GREAT = [
    "Wow, awesome! High five!", "Yay! That was super!", "Woohoo! You nailed it!", "Amazing! You're a star!",
    "Yes! That sounded great!", "Cool! You did it!", "Fantastic! I'm so proud of you!", "Boom! Perfect!",
]
CHEERS_GOOD = [
    "Nice try! You're getting there!", "Good job! Almost perfect!", "Ooh, so close! Great effort!",
    "Hey, that was good! Keep going!",
]
CHEERS_RETRY = [
    "Oops, I didn't catch all of that. No worries!", "Hmm, let's try that one again together!",
    "Almost! Let's give it one more go!", "That's okay, practice makes perfect!",
]
NEXT_INTROS = ["Now try this one:", "Ready for the next one? Say:", "Here comes another one:",
               "Let's keep going! Say:"]
RETRY_INTROS = ["Listen and say it slowly:", "Try again, nice and slow:"]
FINISHED = ("You practiced all the phrases! You're amazing! Now tell me something: what do you like most "
            "about this topic?")


GREETINGS_LESSON = [
    "Hi {name}! I'm Thommy! Today we're going to practice {topic}. This is gonna be awesome!",
    "Hey {name}! Thommy here! Ready to practice {topic}? Let's have some fun!",
    "Hello {name}! Yay, it's English time! Today's adventure is {topic}!",
]
GREETINGS_FREE = [
    "Hi {name}! I'm Thommy, your English buddy! Let's chat!",
    "Hey {name}! Thommy here! I love talking with you. Let's practice together!",
    "Hello {name}! Yay, English time with Thommy!",
]
STARTER_QUESTIONS = [
    "What is your favorite food?", "What do you like to do on weekends?", "Do you have any pets?",
    "What is your favorite color?", "What music do you like?", "Where do you live?",
]


def greeting(name: str | None, topic: str | None, rng: random.Random | None = None) -> str:
    """Saludo carismático inmediato (sin esperar al modelo de lenguaje)."""
    who = name or "there"
    if topic:
        return pick(GREETINGS_LESSON, rng).format(name=who, topic=f'"{topic}"')
    return f"{pick(GREETINGS_FREE, rng).format(name=who)} {pick(STARTER_QUESTIONS, rng)}"


def pick(options: list[str], rng: random.Random | None = None) -> str:
    return (rng or random).choice(options)
