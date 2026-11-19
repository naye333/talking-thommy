"""Cliente del modelo de lenguaje local servido por Ollama.

Ollama nunca se expone al frontend: solo este módulo habla con él (por defecto en 127.0.0.1).
"""
from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass

import httpx

from config.settings import Settings
from services.errors import EngineUnavailableError

log = logging.getLogger(__name__)


@dataclass
class LLMResult:
    content: str
    elapsed_ms: int
    eval_tokens: int | None = None


class LanguageModel:
    def __init__(self, settings: Settings):
        self.s = settings
        self._client = httpx.Client(base_url=settings.ollama_url, timeout=settings.ollama_timeout_s)

    def close(self) -> None:
        self._client.close()

    def check(self) -> dict:
        try:
            r = self._client.get("/api/tags", timeout=5)
            r.raise_for_status()
            names = [m.get("name") for m in r.json().get("models", [])]
            return {"ok": self.s.ollama_model in names, "model": self.s.ollama_model, "installed_models": names}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "model": self.s.ollama_model, "error": f"Ollama not reachable: {e.__class__.__name__}"}

    def chat(self, messages: list[dict], *, json_mode: bool | dict = False, max_tokens: int | None = None,
             temperature: float | None = None) -> LLMResult:
        """`json_mode=True` pide JSON libre; un dict se envía como JSON Schema (salida estructurada)."""
        payload: dict = {
            "model": self.s.ollama_model,
            "messages": messages,
            "stream": False,
            "keep_alive": self.s.ollama_keep_alive,
            "options": {
                "temperature": self.s.ollama_temperature if temperature is None else temperature,
                "num_ctx": self.s.ollama_num_ctx,
                "num_predict": max_tokens or self.s.ollama_max_tokens,
                "repeat_penalty": 1.1,
            },
        }
        if self.s.ollama_think is not None:
            payload["think"] = self.s.ollama_think
        if isinstance(json_mode, dict):
            payload["format"] = json_mode
        elif json_mode:
            payload["format"] = "json"
        t0 = time.perf_counter()
        try:
            r = self._client.post("/api/chat", json=payload)
        except httpx.HTTPError as e:
            log.error("Ollama request failed: %s", e)
            raise EngineUnavailableError("The language model (Ollama) is not available. Is Ollama running?") from e
        if r.status_code != 200:
            log.error("Ollama error %s: %s", r.status_code, r.text[:300])
            raise EngineUnavailableError(f"The language model returned an error ({r.status_code}).")
        data = r.json()
        elapsed = int((time.perf_counter() - t0) * 1000)
        content = (data.get("message") or {}).get("content", "").strip()
        log.info("LLM %d tokens in %d ms", data.get("eval_count") or -1, elapsed)
        return LLMResult(content=content, elapsed_ms=elapsed, eval_tokens=data.get("eval_count"))

    def chat_json(self, messages: list[dict], schema: dict | None = None, **kw) -> tuple[dict | None, LLMResult]:
        """Pide JSON al modelo y lo interpreta de forma tolerante. Devuelve (dict|None, resultado bruto)."""
        res = self.chat(messages, json_mode=schema or True, **kw)
        return parse_json_loose(res.content), res


def parse_json_loose(text: str) -> dict | None:
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            try:
                obj = json.loads(m.group(0))
                return obj if isinstance(obj, dict) else None
            except json.JSONDecodeError:
                return None
    return None
