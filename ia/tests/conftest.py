import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
FIXTURES = ROOT / "tests" / "fixtures"


@pytest.fixture(scope="session")
def client():
    """Cliente contra la API real (usa Ollama, Whisper y Piper de verdad)."""
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def student_wav() -> Path:
    p = FIXTURES / "student_sentence.wav"
    if not p.exists():
        pytest.skip("Run scripts/check_components.py first to create the audio fixtures.")
    return p
