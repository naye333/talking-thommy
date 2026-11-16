"""Orquestador del tutor Thommy: une sesiones, Whisper, Ollama y Piper.

Todas las funciones son síncronas (CPU-bound); las rutas de FastAPI las ejecutan en un
hilo aparte. Un semáforo limita cuántas peticiones pesadas se procesan a la vez.
"""
from __future__ import annotations

import logging
import re
import threading
import time
import uuid
from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from config.settings import PROJECT_ROOT, Settings
from models.schemas import (
    AudioInfo, Correction, ConversationResponse, Evaluation, PronunciationFeedback, SessionEndResponse,
    SessionProgressResponse, SessionStartRequest, SessionStartResponse, SessionSummary, Timings, Turn,
)
from services import practice
from services.errors import EngineUnavailableError
from services.language_model import LanguageModel
from services.pronunciation import PronunciationEvaluator
from services.session_manager import Session, SessionStore
from services.speech_to_text import SpeechToText
from services.text_to_speech import SpeechAudio, TextToSpeech

log = logging.getLogger(__name__)

LEVEL_GUIDES = {
    "A1": "Beginner. Use very short sentences (5-8 words), the most common words, present simple. "
          "Ask simple yes/no or either/or questions. Speak slowly and clearly.",
    "A2": "Elementary. Use short, simple sentences and everyday vocabulary. Present and past simple. "
          "Ask easy questions about personal experience.",
    "B1": "Intermediate. Use clear, natural sentences and common phrasal verbs. "
          "Ask open questions that need a few sentences to answer (why, how, what happened).",
    "B2": "Upper-intermediate. Use natural expressions, varied vocabulary and some idioms. "
          "Ask questions that require opinions, comparisons and explanations.",
    "C1": "Advanced. Speak naturally like with a fluent adult: idioms, nuance, complex sentences. "
          "Ask questions that require arguing, hypothesising and giving detailed examples.",
    "C2": "Proficient. Speak as with a native speaker: rich, precise and idiomatic language. "
          "Challenge the student with abstract or debatable questions. Only correct subtle errors.",
}
REPLY_LENGTH = {
    "A1": "1 or 2 very short sentences (max 25 words)",
    "A2": "2 short sentences (max 35 words)",
    "B1": "2 or 3 sentences (max 50 words)",
    "B2": "2 or 3 sentences (max 60 words)",
    "C1": "2 to 4 sentences (max 70 words)",
    "C2": "2 to 4 sentences (max 70 words)",
}
# Voz algo más lenta para principiantes (mejor listening).
LEVEL_SPEECH_RATE = {"A1": 1.2, "A2": 1.1}

# Salidas estructuradas de Ollama (JSON Schema). Se usan dos llamadas cortas por turno:
#  1) GRAMMAR_SCHEMA: corrector gramatical (temperatura 0). Un modelo pequeño acierta mucho más
#     con una tarea aislada que mezclando corrección y conversación (medido: 11/12 vs 4/8).
#  2) REPLY_SCHEMA: la respuesta conversacional de Thommy, que recibe la corrección como nota.
GRAMMAR_SCHEMA = {
    "type": "object",
    "properties": {"corrected": {"type": "string"}, "explanation": {"type": "string"}},
    "required": ["corrected", "explanation"],
}
REPLY_SCHEMA = {
    "type": "object",
    "properties": {"reaction": {"type": "string"}, "question": {"type": "string"}},
    "required": ["reaction", "question"],
}
_STR_LIST = {"type": "array", "items": {"type": "string"}}
SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {"summary": {"type": "string"}, "strengths": _STR_LIST, "areas_to_improve": _STR_LIST,
                   "vocabulary": _STR_LIST, "next_steps": _STR_LIST},
    "required": ["summary", "strengths", "areas_to_improve", "vocabulary", "next_steps"],
}
# La corrección la inserta el backend (garantizado) entre la reacción y la pregunta, con frases variadas.
CORRECTION_PHRASES = [
    "Small tip: you can say, {c}",
    "By the way, we say: {c}",
    "Just a little correction: {c}",
    "Remember, it's: {c}",
    "A quick tip: {c}",
]
_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️‍]")
_CONTRACTIONS = {"n't": " not", "'ve": " have", "'re": " are", "'ll": " will", "'m": " am", "'d": " would"}

# Diferencias británico/americano que NO son errores (favourite/favorite, realise/realize, centre/center…).
_SPELLING_VARIANTS = [(r"our\b", "or"), (r"our(?=[a-z])", "or"), (r"is(e|ed|es|ing)\b", r"iz\1"),
                      (r"ys(e|ed|es|ing)\b", r"yz\1"), (r"tre\b", "ter"), (r"ll(ed|ing|er)\b", r"l\1"),
                      (r"ogue\b", "og")]


def _norm(s: str) -> str:
    s = s.lower().replace("’", "'").replace("can't", "cannot").replace("won't", "will not")
    for short, full in _CONTRACTIONS.items():  # I've == I have (no es un error)
        s = s.replace(short, full)
    s = re.sub(r"[^a-z0-9' ]", " ", s)
    words = []
    for w in s.split():
        for pat, rep in _SPELLING_VARIANTS:
            w = re.sub(pat, rep, w)
        words.append(w)
    return " ".join(words)


class Tutor:
    def __init__(self, settings: Settings, store: SessionStore, stt: SpeechToText, llm: LanguageModel,
                 tts: TextToSpeech, pronunciation: PronunciationEvaluator):
        self.s, self.store, self.stt, self.llm, self.tts, self.pron = settings, store, stt, llm, tts, pronunciation
        self._system_template = (PROJECT_ROOT / "prompts" / "thommy_system_prompt.txt").read_text(encoding="utf-8")
        self._summary_template = (PROJECT_ROOT / "prompts" / "summary_prompt.txt").read_text(encoding="utf-8")
        self._grammar_prompt = (PROJECT_ROOT / "prompts" / "grammar_check_prompt.txt").read_text(encoding="utf-8")
        self._pipeline = threading.BoundedSemaphore(settings.max_concurrent_pipelines)
        self._session_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)

    def warm_up(self) -> None:
        """Precarga la voz de Piper y el modelo de Ollama para que la primera sesión no sea lenta."""
        t0 = time.perf_counter()
        try:
            self.tts._load(self.tts.resolve_voice(None))
        except Exception as e:  # noqa: BLE001
            log.warning("Piper warm-up failed: %s", e)
        try:
            self.llm.chat([{"role": "user", "content": "Hi"}], max_tokens=1)
        except Exception as e:  # noqa: BLE001
            log.warning("Ollama warm-up failed: %s", e)
        log.info("Warm-up finished in %d ms", int((time.perf_counter() - t0) * 1000))

    def _prime_llm(self, session: Session) -> None:
        try:
            messages = [{"role": "system", "content": self.system_prompt(session)}]
            messages += session.llm_history(self.s.history_max_messages)
            messages.append({"role": "user", "content": "Hi"})
            self.llm.chat(messages, max_tokens=1)
        except Exception as e:  # noqa: BLE001
            log.info("LLM priming skipped: %s", e)

    @contextmanager
    def _busy(self, session_id: str):
        # Una petición a la vez por sesión (mantiene el orden del historial) y límite global de CPU.
        with self._session_locks[session_id], self._pipeline:
            yield

    # ------------------------------------------------------------ prompts
    def system_prompt(self, session: Session) -> str:
        lesson = session.lesson or {}
        lesson_info = "none (free conversation)"
        if lesson:
            parts = [f'"{lesson.get("title")}"']
            if lesson.get("grammar"):
                parts.append("grammar: " + ", ".join(lesson["grammar"][:6]))
            if lesson.get("vocabulary"):
                parts.append("useful words: " + ", ".join(lesson["vocabulary"][:12]))
            lesson_info = "; ".join(parts)
        return self._system_template.format(
            student_name=session.student_name or "my friend",
            level=session.level,
            level_guide=LEVEL_GUIDES[session.level],
            topic=session.topic,
            learning_goal=session.learning_goal,
            lesson_info=lesson_info,
            reply_length=REPLY_LENGTH[session.level],
        )

    # --------------------------------------------------------- gramática
    def check_grammar(self, text: str) -> tuple[Correction | None, int]:
        """Paso 1: corrector aislado. Devuelve (corrección o None, ms)."""
        if len(text.split()) < 2:
            return None, 0
        messages = [{"role": "system", "content": self._grammar_prompt},
                    {"role": "user", "content": f"Input: {text}"}]
        try:
            data, res = self.llm.chat_json(messages, schema=GRAMMAR_SCHEMA, temperature=0.0, max_tokens=100)
        except EngineUnavailableError:
            raise
        return self.parse_correction(text, data), res.elapsed_ms

    @staticmethod
    def parse_correction(original: str, data: dict | None) -> Correction | None:
        if not data:
            return None
        corrected = str(data.get("corrected") or "").strip()
        # Sin cambios reales (solo puntuación/mayúsculas/ortografía UK-US) => no hay error.
        if not corrected or _norm(corrected) == _norm(original):
            return None
        # Protección: si el "corregido" es otra frase totalmente distinta, no es una corrección mínima.
        a, b = set(_norm(original).split()), set(_norm(corrected).split())
        if a and len(a & b) / len(a) < 0.5:
            log.info("Discarding non-minimal correction: %r -> %r", original, corrected)
            return None
        # En habla no hay comas ni mayúsculas (las pone Whisper): esas "correcciones" no aplican.
        explanation = str(data.get("explanation") or "")
        if re.search(r"comma|punctuation|capital|full stop|period|apostrophe", explanation, re.I):
            log.info("Discarding punctuation-only correction: %r -> %r", original, corrected)
            return None
        return Correction(original=original.strip(), corrected=corrected,
                          explanation=str(data.get("explanation") or "").strip())

    # ------------------------------------------------------------ respuesta
    def _ask_thommy(self, session: Session, correction: Correction | None = None,
                    extra_user_msg: str | None = None, with_question: bool = True) -> tuple[str, int]:
        """Paso 2: respuesta conversacional = reacción + [corrección] + pregunta.

        with_question=False: solo reacción (+ corrección), p. ej. cuando después viene una frase a practicar.
        """
        messages = [{"role": "system", "content": self.system_prompt(session)}]
        messages += session.llm_history(self.s.history_max_messages)
        if extra_user_msg:
            messages.append({"role": "user", "content": extra_user_msg})
        data, res = self.llm.chat_json(messages, schema=REPLY_SCHEMA)
        phrase = None
        if correction:
            template = CORRECTION_PHRASES[len(session.corrections) % len(CORRECTION_PHRASES)]
            phrase = template.format(c=correction.corrected)
        last = messages[-1]["content"] if messages[-1]["role"] == "user" else ""
        student_asked = "?" in last
        if not with_question and data:
            data = {**data, "question": ""}
        reply = self.parse_reply(data, res.content, session.session_id, phrase, student_asked=student_asked)
        if not with_question and not student_asked:
            # Sin pregunta propia: la "pregunta" será la frase a practicar.
            kept = [s for s in re.split(r"(?<=[.!?])\s+", reply) if not s.endswith("?")]
            reply = " ".join(kept).strip() or "Hi! I'm Thommy!"
        return reply, res.elapsed_ms

    @staticmethod
    def parse_reply(data: dict | None, raw: str, session_id: str = "", correction_phrase: str | None = None,
                    student_asked: bool = False) -> str:
        data = data or {}

        def clean(s) -> str:
            s = str(s or "").replace("’", "'").replace("‘", "'")
            s = _EMOJI.sub("", s)                                # sin emojis: se leen en voz alta y en pantalla
            s = re.sub(r"[\"“”]", "", s)                 # comillas: no aportan al habla
            s = re.sub(r"([.!?])[\s,.;:]*(?=\s|$)", r"\1", s)    # "?” ,." -> "?"
            return re.sub(r"\s+", " ", s).strip(" ,;:")

        reaction = clean(data.get("reaction") or data.get("reply"))
        question = clean(data.get("question"))
        # Si el estudiante preguntó algo, la reacción es la respuesta: no se toca aunque tenga "?".
        if question and "?" in reaction and not student_asked:
            # Una sola pregunta por turno: quitar las preguntas que el modelo metió en la reacción.
            kept = [s for s in re.split(r"(?<=[.!?])\s+", reaction) if not s.endswith("?")]
            reaction = " ".join(kept).strip()
        if not reaction and not question and raw and not raw.lstrip().startswith("{"):
            reaction = raw.strip()  # el modelo respondió texto plano
        if not reaction and not question:
            log.warning("Empty/invalid LLM reply for session %s: %r", session_id, (raw or "")[:200])
            reaction, question = "Sorry, I didn't catch that.", "Could you tell me again in a different way?"
        if not reaction and correction_phrase:
            reaction = "Nice!"
        if reaction and reaction[-1] not in ".!?":
            reaction += "."
        parts = [reaction]
        if correction_phrase:
            parts.append(correction_phrase)
        if question and question not in reaction:
            parts.append(question)
        return " ".join(p for p in parts if p)

    # -------------------------------------------------------------- audio
    def _audio_path(self, session_id: str, turn: int) -> Path:
        return self.s.audio_dir / session_id / f"{turn:03d}-{uuid.uuid4().hex[:8]}.{self.s.audio_format}"

    def _speak(self, session: Session, text: str, turn: int, include_b64: bool) -> tuple[AudioInfo, int]:
        audio: SpeechAudio = self.tts.synthesize(
            text, self._audio_path(session.session_id, turn), voice=session.voice,
            length_scale=LEVEL_SPEECH_RATE.get(session.level),
        )
        info = AudioInfo(
            url=f"/audio/{session.session_id}/{audio.path.name}", format=audio.format, mime_type=audio.mime_type,
            sample_rate=audio.sample_rate, duration_seconds=audio.duration_seconds, voice=audio.voice,
            base64=audio.as_base64() if include_b64 else None,
        )
        return info, audio.elapsed_ms

    @staticmethod
    def spoken_text(text: str, phrase: str | None) -> str:
        """Lo que dice Thommy en voz alta: el texto y, si hay, la frase a practicar (igual que la app)."""
        return f"{text} {phrase}" if phrase else text

    # ----------------------------------------------------------- sesiones
    def start_session(self, req: SessionStartRequest) -> SessionStartResponse:
        voice = self.tts.resolve_voice(req.voice)
        lesson = req.lesson.model_dump() if req.lesson else None
        topic = req.lesson.title if req.lesson else req.topic
        goal = (req.lesson.objective if req.lesson and req.lesson.objective else req.learning_goal)
        session = self.store.create(student_id=req.student_id, level=req.level.value, topic=topic,
                                    learning_goal=goal, voice=voice, student_name=req.student_name, lesson=lesson)
        phrases = session.model_phrases
        with self._busy(session.session_id):
            # Saludo inmediato con plantillas (antes tardaba 7-26 s esperando al modelo).
            if phrases:
                # Práctica de tema: saludo y la primera frase modelo para repetir.
                greeting = f"{practice.greeting(session.student_name, topic)} Try saying this:"
                phrase = phrases[0]
                session.target_phrase = phrase
            else:
                greeting = practice.greeting(session.student_name, None if topic == "daily life" else topic)
                phrase = None
                if topic != "daily life":  # tema sin frases modelo: pregunta abierta sobre el tema
                    greeting = f"{greeting} What can you tell me about it?"
            spoken = self.spoken_text(greeting, phrase)
            session.add_turn("thommy", spoken, source="system")
            self.store.save(session)
            audio, _ = self._speak(session, spoken, 0, req.include_audio_base64)
        # Mientras el estudiante escucha el saludo, se precalienta el modelo con el prompt de esta sesión
        # (Ollama reutiliza ese prefijo en el primer turno y responde más rápido).
        threading.Thread(target=self._prime_llm, args=(session,), daemon=True).start()
        return SessionStartResponse(
            session_id=session.session_id, student_id=session.student_id, level=session.level,
            topic=session.topic, learning_goal=session.learning_goal, voice=session.voice,
            greeting=greeting, phrase=phrase, audio=audio, created_at=datetime.fromisoformat(session.started_at),
        )

    def _phrase_attempt(self, session: Session, text: str) -> Evaluation | None:
        """Si hay frase objetivo y el estudiante la intentó, devuelve su evaluación; si habló libre, None."""
        target = session.target_phrase
        if not target:
            return None
        if practice.phrase_match(target, text) >= practice.ATTEMPT_MIN_MATCH or len(practice.tokens(text)) <= 2:
            return practice.evaluate_phrase(target, text)
        return None

    def _next_phrase_reply(self, session: Session, evaluation: Evaluation) -> tuple[str, str | None]:
        """Respuesta rápida (sin modelo) a un intento de frase: ánimo + siguiente frase o repetir."""
        session.attempts += 1
        if evaluation.level == "excelente":
            cheer = practice.pick(practice.CHEERS_GREAT)
        elif evaluation.level == "bien":
            cheer = practice.pick(practice.CHEERS_GOOD)
        else:
            cheer = practice.pick(practice.CHEERS_RETRY)
        # Se avanza si salió bien o tras 2 intentos (para no frustrar al estudiante).
        if evaluation.level != "practicar" or session.attempts >= 2:
            session.phrase_index += 1
            session.attempts = 0
            phrases = session.model_phrases
            if session.phrase_index < len(phrases):
                session.target_phrase = phrases[session.phrase_index]
                return f"{cheer} {practice.pick(practice.NEXT_INTROS)}", session.target_phrase
            session.target_phrase = None  # terminó las frases: sigue la conversación libre
            return f"{cheer} {practice.FINISHED}", None
        return f"{cheer} {practice.pick(practice.RETRY_INTROS)}", session.target_phrase

    def _respond(self, session: Session, text: str, source: str, *, include_audio: bool, include_b64: bool,
                 stt_ms: int | None, t0: float, pronunciation: PronunciationFeedback) -> ConversationResponse:
        correction, grammar_ms, llm_ms = None, None, None
        evaluation = self._phrase_attempt(session, text)
        if evaluation:
            # El estudiante repitió la frase modelo: se evalúa la frase (sin corrector ni modelo: más rápido).
            session.add_turn("student", text, source=source)
            reply, phrase = self._next_phrase_reply(session, evaluation)
        else:
            correction, grammar_ms = self.check_grammar(text)
            session.add_turn("student", text, source=source,
                             correction=correction.model_dump() if correction else None)
            target = session.target_phrase
            try:
                reply, llm_ms = self._ask_thommy(session, correction=correction, with_question=target is None)
            except Exception:
                session.turns.pop()  # no dejar el turno del estudiante sin respuesta en el historial
                raise
            phrase = target
            if target:  # habló libre durante la práctica: Thommy reacciona y vuelve a la frase
                reply = f"{reply} {practice.pick(practice.NEXT_INTROS)}"
            evaluation = practice.evaluate_free(text, correction)

        spoken = self.spoken_text(reply, phrase)
        session.add_turn("thommy", spoken)
        self.store.save(session)
        turn_no = len(session.student_turns)

        audio, tts_ms = (None, None)
        if include_audio:
            audio, tts_ms = self._speak(session, spoken, turn_no, include_b64)
        return ConversationResponse(
            session_id=session.session_id, turn=turn_no, transcription=text, reply=reply, phrase=phrase,
            correction=correction, evaluation=evaluation, audio=audio, pronunciation=pronunciation,
            timings=Timings(speech_to_text_ms=stt_ms, grammar_check_ms=grammar_ms, language_model_ms=llm_ms,
                            text_to_speech_ms=tts_ms,
                            total_ms=int((time.perf_counter() - t0) * 1000)),
        )

    def handle_text(self, session_id: str, message: str, include_audio: bool = True,
                    include_b64: bool = False) -> ConversationResponse:
        t0 = time.perf_counter()
        session = self.store.get_active(session_id)
        with self._busy(session_id):
            return self._respond(session, message.strip(), "text", include_audio=include_audio,
                                 include_b64=include_b64, stt_ms=None, t0=t0,
                                 pronunciation=self.pron.evaluate(None, message, session.level))

    @staticmethod
    def stt_context(session: Session) -> str | None:
        """Contexto para Whisper: lo último que dijo Thommy y el vocabulario del tema.

        No incluye la frase objetivo: si Whisper la "espera", tiende a escribirla aunque el estudiante la diga mal,
        y el puntaje de la frase saldría inflado.
        """
        parts = []
        last = next((t.text for t in reversed(session.turns) if t.role == "thommy"), "")
        if session.target_phrase and last.endswith(session.target_phrase):
            last = last[: -len(session.target_phrase)].strip()
        if last:
            parts.append(last)
        vocabulary = (session.lesson or {}).get("vocabulary") or []
        if vocabulary:
            parts.append("Words: " + ", ".join(vocabulary[:15]) + ".")
        return " ".join(parts) or None

    def handle_audio(self, session_id: str, audio_path: Path, include_b64: bool = False) -> ConversationResponse:
        t0 = time.perf_counter()
        session = self.store.get_active(session_id)
        with self._busy(session_id):
            context = self.stt_context(session) if self.s.whisper_use_context else None
            tr = self.stt.transcribe(audio_path, context=context)
            pron = self.pron.evaluate(None, tr.text, session.level)
            return self._respond(session, tr.text, "audio", include_audio=True, include_b64=include_b64,
                                 stt_ms=tr.elapsed_ms, t0=t0, pronunciation=pron)

    # ----------------------------------------------------------- progreso
    def progress(self, session_id: str) -> SessionProgressResponse:
        s = self.store.get(session_id)
        corrections = [Correction(**c) for c in s.corrections]
        n = len(s.student_turns)
        practice = (
            f"{n} speaking turn(s), {s.student_word_count} words spoken about '{s.topic}' at level {s.level}. "
            f"{len(corrections)} correction(s) so far."
        )
        return SessionProgressResponse(
            session_id=s.session_id, student_id=s.student_id, level=s.level, topic=s.topic,
            learning_goal=s.learning_goal, status=s.status,
            started_at=datetime.fromisoformat(s.started_at),
            last_activity_at=datetime.fromisoformat(s.last_activity_at),
            duration_seconds=s.duration_seconds(), student_turns=n, student_words=s.student_word_count,
            audio_turns=sum(1 for t in s.student_turns if t.source == "audio"),
            corrections=corrections,
            history=[Turn(index=t.index, role=t.role, text=t.text, timestamp=datetime.fromisoformat(t.timestamp),
                          source=t.source, correction=Correction(**t.correction) if t.correction else None)
                     for t in s.turns],
            practice_summary=s.summary["summary"] if s.summary else practice,
            feedback_available=bool(corrections) or bool(s.summary),
        )

    def end_session(self, session_id: str) -> SessionEndResponse:
        session = self.store.get_active(session_id)
        with self._busy(session_id):
            summary = self._summarize(session)
            self.store.end(session, summary.model_dump())
        return SessionEndResponse(session_id=session_id, status="ended",
                                  duration_seconds=session.duration_seconds(),
                                  student_turns=len(session.student_turns),
                                  student_words=session.student_word_count, summary=summary)

    def _summarize(self, session: Session) -> SessionSummary:
        corrections = [Correction(**c) for c in session.corrections]
        if not session.student_turns:
            return SessionSummary(summary="The session ended before the student spoke.", strengths=[],
                                  areas_to_improve=[], corrections=[], vocabulary=[],
                                  next_steps=["Start a new session and answer Thommy's first question."],
                                  pronunciation=PronunciationFeedback())
        transcript = "\n".join(f"Student: {t.text}" for t in session.student_turns)
        corr_text = "\n".join(f'- "{c.original}" -> "{c.corrected}" ({c.explanation})' for c in corrections) \
            or "- none"
        prompt = self._summary_template.format(level=session.level, topic=session.topic,
                                               learning_goal=session.learning_goal, transcript=transcript[-5000:],
                                               corrections=corr_text)
        data = None
        try:
            data, _ = self.llm.chat_json([{"role": "user", "content": prompt}], schema=SUMMARY_SCHEMA,
                                         max_tokens=350, temperature=0.2)
        except EngineUnavailableError:
            log.warning("LLM unavailable for summary; using basic summary")
        data = data or {}

        def as_list(key: str) -> list[str]:
            v = data.get(key)
            if isinstance(v, str):
                v = [v]
            return [str(x).strip() for x in (v or []) if str(x).strip()][:6]

        n, words = len(session.student_turns), session.student_word_count
        summary = str(data.get("summary") or "").strip()
        strengths = as_list("strengths")
        areas = as_list("areas_to_improve")
        if corrections:
            # Un modelo pequeño a veces elogia la gramática que justamente se corrigió: se filtra.
            praise = re.compile(r"\bcorrect(ly)?\b|\bgrammar\b|\baccurate|\btense\b|\bpast\b|\bpresent\b|\bverb",
                                re.I)
            strengths = [x for x in strengths if not praise.search(x)]
            if praise.search(summary):
                summary = ""
            # Áreas de mejora deterministas a partir de las correcciones reales (sin inventar).
            areas, seen = [], set()
            for c in corrections:
                key = (c.explanation or c.corrected).lower()
                if key not in seen:
                    seen.add(key)
                    areas.append(f'{c.explanation} Example: "{c.corrected}"'.strip() if c.explanation
                                 else f'Say "{c.corrected}"')
            areas = areas[:4]
        if not summary:
            summary = f"You practiced speaking about {session.topic} in {n} turns and said {words} words."
            if corrections:
                summary += f" Keep practicing this: {corrections[0].explanation or corrections[0].corrected}"
        if not strengths:
            strengths = [f"You kept the conversation going for {n} turns."]
        # Vocabulario: solo palabras que realmente aparecieron en la conversación (evita inventos).
        convo = " ".join(t.text for t in session.turns).lower() + " " + \
            " ".join(c.corrected for c in corrections).lower()
        vocabulary = [v for v in as_list("vocabulary")
                      if any(len(w) > 2 and w in convo for w in re.findall(r"[a-z']+", v.lower()))]
        return SessionSummary(
            summary=summary, strengths=strengths, areas_to_improve=areas,
            corrections=corrections, vocabulary=vocabulary, next_steps=as_list("next_steps"),
            pronunciation=PronunciationFeedback(),
        )
