"""Punto de extensión para un evaluador fonético (versión futura).

Una transcripción de Whisper NO sirve para juzgar la pronunciación: Whisper corrige
automáticamente muchas palabras mal pronunciadas. Por eso hoy se usa `NullPronunciationEvaluator`,
que devuelve siempre `available=False`.

Para añadir evaluación real (p. ej. Goodness of Pronunciation con un modelo de alineamiento
fonético como wav2vec2-phoneme o Montreal Forced Aligner), implementar `PronunciationEvaluator`
y registrarlo en `api/dependencies.py`.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from models.schemas import PronunciationFeedback


class PronunciationEvaluator(ABC):
    @abstractmethod
    def evaluate(self, wav_16k_path: Path, transcript: str, level: str) -> PronunciationFeedback:
        """Recibe el WAV 16 kHz mono y el texto reconocido; devuelve la evaluación."""


class NullPronunciationEvaluator(PronunciationEvaluator):
    def evaluate(self, wav_16k_path: Path | None, transcript: str, level: str) -> PronunciationFeedback:
        return PronunciationFeedback()
