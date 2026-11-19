"""Pruebas rápidas sin motores (no necesitan Ollama, Whisper ni Piper)."""
from services.language_model import parse_json_loose
from services.session_manager import Session
from services.speech_to_text import SpeechToText


def test_whisper_noise_tags_are_removed():
    assert SpeechToText.clean(" [BLANK_AUDIO] ") == ""
    assert SpeechToText.clean("(music) Hello there [laughs]") == "Hello there"
    assert SpeechToText.clean(" ... ") == ""


def test_parse_json_loose():
    assert parse_json_loose('{"reply": "Hi"}') == {"reply": "Hi"}
    assert parse_json_loose('Sure! {"reply": "Hi", "correction": null} ok') == {"reply": "Hi", "correction": None}
    assert parse_json_loose("no json here") is None


def test_history_is_truncated_and_mapped():
    s = Session(session_id="a" * 32, student_id="x", level="A2", topic="t", learning_goal="g", voice="v")
    for i in range(10):
        s.add_turn("student", f"s{i}")
        s.add_turn("thommy", f"t{i}")
    h = s.llm_history(4)
    assert [m["role"] for m in h] == ["user", "assistant", "user", "assistant"]
    assert h[-1]["content"] == "t9"
    assert s.student_word_count == 10


def test_correction_filters():
    from services.tutor import Tutor

    pc = Tutor.parse_correction
    # Solo puntuación / mayúsculas => no es error
    assert pc("i like it", {"corrected": "I like it.", "explanation": ""}) is None
    # Ortografía británica vs americana => no es error
    assert pc("My favourite colour is blue", {"corrected": "My favorite color is blue."}) is None
    assert pc("I realised it", {"corrected": "I realized it"}) is None
    # Error real
    c = pc("Yesterday I go to the school.", {"corrected": "Yesterday I went to school.", "explanation": "past"})
    assert c is not None and c.corrected == "Yesterday I went to school."
    # Frase totalmente distinta => no es una corrección mínima
    assert pc("I go to school", {"corrected": "The weather is nice today."}) is None
    assert pc("hello there", None) is None
    # Correcciones de puntuación no aplican al habla
    assert pc("We play and then we eat", {"corrected": "We play, then we eat",
                                          "explanation": "Use comma to separate clauses."}) is None


def test_summary_never_praises_corrected_grammar():
    from types import SimpleNamespace

    from config.settings import get_settings
    from services.tutor import Tutor

    class FakeLLM:  # simula un modelo que contradice las correcciones
        def chat_json(self, *a, **k):
            return {"summary": "You used the past simple correctly.", "strengths": ["Correct past tense", "Good ideas"],
                    "areas_to_improve": ["we go, not we went"], "vocabulary": ["school"], "next_steps": []}, None

    s = Session(session_id="b" * 32, student_id="x", level="A2", topic="school", learning_goal="g", voice="v")
    s.add_turn("student", "Yesterday I go to school",
               correction={"original": "Yesterday I go to school", "corrected": "Yesterday I went to school",
                           "explanation": "Use the past simple."})
    tutor = Tutor(get_settings(), None, None, FakeLLM(), None, None)
    out = tutor._summarize(s)
    assert "correctly" not in out.summary
    assert out.strengths == ["Good ideas"]
    assert out.areas_to_improve == ['Use the past simple. Example: "Yesterday I went to school"']


def test_phrase_evaluation():
    from services.practice import evaluate_phrase, phrase_match

    ev = evaluate_phrase("Hi, let me introduce myself.", "hi let me introduce myself")
    assert ev.score == 100 and ev.level == "excelente" and all(w.ok for w in ev.words)
    ev = evaluate_phrase("Hi, let me introduce myself.", "Hi, let me in produce myself.")
    bad = [w for w in ev.words if not w.ok]
    assert [w.text for w in bad] == ["introduce"] and bad[0].hint_es == 'Repite despacio: "introduce"'
    assert ev.level == "bien" and "introduce" in ev.message_es
    # números y contracciones no penalizan
    assert evaluate_phrase("I am three years old.", "I'm 3 years old").score == 100
    assert phrase_match("Nice to meet you.", "I like pizza") < 0.5


def test_whisper_context_excludes_target_phrase():
    from services.tutor import Tutor

    s = Session(session_id="c" * 32, student_id="x", level="A1", topic="Colors", learning_goal="g", voice="v",
                lesson={"title": "Colors", "vocabulary": ["yellow", "blue", "notebook"], "model_phrases": []})
    s.add_turn("thommy", "Cool! What color is your notebook?")
    assert Tutor.stt_context(s) == "Cool! What color is your notebook? Words: yellow, blue, notebook."
    s.target_phrase = "The pen is blue."
    s.add_turn("thommy", "Yay! Now try this one: The pen is blue.")
    assert "The pen is blue" not in Tutor.stt_context(s)
    assert Tutor.stt_context(Session(session_id="d" * 32, student_id="x", level="A1", topic="t",
                                     learning_goal="g", voice="v")) is None


def test_instant_greetings():
    import random

    from services.practice import greeting

    rng = random.Random(1)
    lesson = greeting("Ana", "Introducing yourself", rng)
    assert "Ana" in lesson and '"Introducing yourself"' in lesson
    free = greeting(None, None, rng)
    assert free.startswith(("Hi there", "Hey there", "Hello there")) and free.endswith("?")


def test_free_evaluation_marks_corrected_words():
    from models.schemas import Correction
    from services.practice import evaluate_free

    ok = evaluate_free("I like pizza.", None)
    assert ok.score == 100 and ok.kind == "grammar"
    ev = evaluate_free("Yesterday I go to school.",
                       Correction(original="Yesterday I go to school.", corrected="Yesterday I went to school."))
    bad = [w for w in ev.words if not w.ok]
    assert [w.text for w in bad] == ["go"] and bad[0].hint_es == 'Mejor di: "went"'
    assert ev.level != "excelente" and "went" in ev.message_es


def test_parse_reply_fallbacks():
    from services.tutor import Tutor

    assert Tutor.parse_reply({"reaction": "Nice!", "question": "Why?"}, "") == "Nice! Why?"
    assert Tutor.parse_reply({"reaction": "Nice!", "question": "Why?"}, "", "", "Tip: I went.") == \
        "Nice! Tip: I went. Why?"
    assert Tutor.parse_reply({"reaction": "Great!\nIs it fun? I love it.", "question": "Why?"}, "") == \
        "Great! I love it. Why?"
    # Si el estudiante preguntó, la respuesta en forma de pregunta se conserva
    assert Tutor.parse_reply({"reaction": "Rocky loves the ball, right?", "question": "Why?"}, "",
                             student_asked=True) == "Rocky loves the ball, right? Why?"
    assert Tutor.parse_reply({"reaction": "It’s fun.", "question": "Why?"}, "") == "It's fun. Why?"
    assert Tutor.parse_reply(None, "Plain text answer") == "Plain text answer."
    # Sin emojis en el texto que se muestra y se lee
    assert Tutor.parse_reply({"reaction": "Let's make it fun! 🌟.", "question": "Ready? 😀"}, "") == \
        "Let's make it fun! Ready?"
    assert Tutor.parse_reply(None, "{broken").startswith("Sorry")
    # Contracciones no cuentan como error
    assert Tutor.parse_correction("I've been working", {"corrected": "I have been working"}) is None
