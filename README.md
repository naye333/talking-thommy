# talking-thommy
Tutor conversacional con IA para práctica de inglés

| Carpeta | Qué es | Tecnología |
|---|---|---|
| [`frontend/`](frontend/README.md) | App móvil (web + Android con Capacitor) | HTML, CSS, JavaScript |
| [`backend/`](backend/README.md) | API REST + WebSocket, usuarios, syllabus y sesiones con Thommy | Node.js, Express, PostgreSQL (Neon) |
| [`ia/`](ia/README.md) | Tutor de IA: escucha, corrige, responde y habla con voz de niño | Python, FastAPI, Whisper.cpp, Ollama (Qwen3 1.7B), Piper |
| [`docs/`](docs/) | Acta, contrato de la API y propuestas | |

```
App (micrófono) ──WebSocket──► backend ──HTTP interno──► ia/ ──► Whisper → Thommy (Ollama) → voz (Piper)
       ◄── transcripción, evaluación y voz de Thommy (MP3) ──┘
```

## Levantar todo en un PC (desarrollo)

Requisitos: Node.js 20+, Python 3.11+, y la instalación de la IA (`ia/scripts/setup.ps1`, una sola vez). Abre tres terminales:

```bash
# 1) Servicio de IA (también inicia Ollama si hace falta) → http://127.0.0.1:8000/docs
powershell -ExecutionPolicy Bypass -File ia/scripts/start.ps1

# 2) Backend → http://localhost:3000/api/salud   (necesita DATABASE_URL en backend/.env)
cd backend && npm install && npm run dev

# 3) App → http://localhost:8081   (en el navegador: F12 → Ctrl+Shift+M para vista de celular)
cd frontend && npm install && npm run dev
```

Ingresa como estudiante, entra a una lección y toca el micrófono: Thommy saluda, escucha, corrige y responde hablando.
