"""Excepciones del dominio. `main.py` las convierte en respuestas JSON con el código HTTP indicado."""


class ThommyError(Exception):
    status_code = 500
    code = "internal_error"

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class InvalidAudioError(ThommyError):
    status_code = 400
    code = "invalid_audio"


class InvalidVoiceError(ThommyError):
    status_code = 400
    code = "invalid_voice"


class AudioTooLargeError(ThommyError):
    status_code = 413
    code = "audio_too_large"


class UnintelligibleAudioError(ThommyError):
    status_code = 422
    code = "speech_not_recognized"


class SessionNotFoundError(ThommyError):
    status_code = 404
    code = "session_not_found"


class SessionEndedError(ThommyError):
    status_code = 409
    code = "session_ended"


class EngineUnavailableError(ThommyError):
    """Un motor (Ollama, Whisper, Piper, ffmpeg) no está disponible o falló."""
    status_code = 503
    code = "engine_unavailable"
