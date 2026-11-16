# Talking Thommy – Servicio de IA y voz

Tutor de inglés que **escucha** al estudiante, **entiende** lo que dice, **corrige** con cariño, **responde** como un
niño carismático y lo **dice en voz alta**. Funciona 100 % local, en CPU, sin APIs de pago.

```
audio del estudiante ─► ffmpeg ─► Whisper.cpp ─► evaluación ─► Thommy (Ollama) ─► Piper (voz de niño) ─► JSON + MP3
                          16 kHz     base.en       frase/gramática   Qwen3 1.7B          kristin +28 % tono
```

**Solo el backend de Node llama a este servicio** (`backend/src/servicios/servicioTutorIa.js`). La app nunca habla
con la IA ni con Ollama, que escuchan únicamente en `127.0.0.1`.

## Cómo conversa Thommy

| Modo | Cuándo | Qué hace | Tiempo por turno* |
|---|---|---|---|
| **Práctica de frases** | La sesión tiene un tema del syllabus con `frasesModelo` | Pide repetir cada frase. Compara lo que entendió con la frase, marca las palabras a practicar y celebra. Avanza si salió bien o tras 2 intentos | ≈ 5-8 s (no usa el modelo de lenguaje) |
| **Conversación** | Sin tema, al terminar las frases, o si el estudiante habla de otra cosa | Corrige la gramática (corrector aparte, temperatura 0), reacciona a lo que dijo y hace una pregunta | ≈ 15 s |

\* PC de desarrollo: Intel i5-8250U, 8 GB RAM, sin GPU.

**Personalidad** (`prompts/thommy_system_prompt.txt`): un niño alegre, curioso y carismático ("Awesome!", "High five!"),
paciente y respetuoso. Adapta el lenguaje al nivel (Inglés I → A1, Inglés II → A2). Nunca opina sobre la pronunciación.

### Sobre el puntaje (importante)

- En **práctica de frases** el puntaje es **"Palabras entendidas"**: qué palabras de la frase reconoció Whisper.
  Mide inteligibilidad, **no es un análisis fonético**. Whisper a veces "corrige" palabras mal pronunciadas, así
  que el puntaje puede ser generoso. Es provisional hasta conectar un evaluador fonético en
  `services/pronunciation.py` (lo pide el Acta).
- En **conversación** el puntaje es **"Gramática"**, según las palabras que cambió el corrector.

## Instalación (Windows, una sola vez)

```bash
powershell -ExecutionPolicy Bypass -File ia/scripts/setup.ps1
```

Instala Ollama y ffmpeg, crea `.venv`, descarga whisper.cpp, el modelo `base.en`, las voces y `qwen3:1.7b`
(~2,7 GB) y genera `ia/.env`. Los modelos y binarios **no se suben a git** (`.gitignore`).

## Iniciar

```bash
powershell -ExecutionPolicy Bypass -File ia/scripts/start.ps1
```

Swagger: http://127.0.0.1:8000/docs · Estado de los motores: http://127.0.0.1:8000/health

## Configuración (`ia/.env`)

| Variable | Por defecto | Para qué |
|---|---|---|
| `OLLAMA_MODEL` / `OLLAMA_THINK` | `qwen3:1.7b` / `false` | Modelo de lenguaje (alternativa más ligera: `qwen2.5:1.5b`) |
| `PIPER_VOICE` | `en_US-kristin-medium` | Voz base de Thommy (archivo `.onnx` en `models/piper/`) |
| `PIPER_PITCH` | `1.28` | Tono: `1.0` = voz original; `1.2`-`1.4` = voz de niño |
| `AUDIO_FORMAT` | `mp3` | `mp3` (ligero, para la app) o `wav` |
| `API_KEY` | vacío | Si se define, el backend debe enviar `X-API-Key` (`CLAVE_SERVICIO_IA`) |
| `MAX_CONCURRENT_PIPELINES` | `1` | Peticiones pesadas a la vez (1 en un PC de 8 GB) |

Ver todas en `.env.example`.

**Voz infantil:** Piper habla `PIPER_PITCH` veces más despacio y el audio se reproduce `PIPER_PITCH` veces más rápido:
el tono sube y la velocidad queda normal, sin filtros.

## API que usa el backend

| Método | Ruta | Uso |
|---|---|---|
| POST | `/session/start` | `{ student_id, level, student_name?, lesson?: { title, objective, grammar, vocabulary, model_phrases }, include_audio_base64 }` → `{ session_id, greeting, phrase, audio }` |
| POST | `/conversation/audio` | multipart `session_id`, `audio` → `{ transcription, reply, phrase, evaluation, correction, audio, timings }` |
| GET | `/session/{id}/progress`, POST `/session/end` | Historial y resumen del aprendizaje |
| POST | `/conversation/text` | Solo para pruebas internas (la app es solo voz) |

Detalle de los campos: [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) y Swagger.

## Pruebas

```bash
cd ia
.venv\Scripts\python.exe scripts\check_components.py   # cada motor por separado (crea los audios de prueba)
.venv\Scripts\python.exe -m pytest tests -v            # unitarias + API con los motores reales (~4 min)
.venv\Scripts\python.exe scripts\eval_tutor.py         # calidad de las correcciones (12 frases)
```

## Requisitos de hardware

| | Desarrollo (probado) | Servidor recomendado |
|---|---|---|
| CPU | 4 núcleos con AVX2 | 4-8 vCPU con AVX2 |
| RAM | 8 GB (el servicio usa ≈ 2,5-3 GB) | 8 GB; 16 GB para varios estudiantes a la vez |
| GPU | No necesaria | No necesaria |

## Licencias (uso comercial)

| Componente | Licencia |
|---|---|
| Qwen3 1.7B, Ollama | Apache 2.0, MIT |
| whisper.cpp y `ggml-base.en` | MIT |
| Voz **en_US-kristin-medium** (Thommy) | Dominio público (LibriVox) |
| Voz en_US-joe-medium (audio de prueba) | CC0 |
| Voz en_GB-cori-medium (opcional) | **CC BY 4.0**: si se usa, hay que dar crédito (Hi-Fi Multi-Speaker English TTS Dataset, NVIDIA) |
| Piper (`piper-tts`) | GPL-3.0 (revisar si el producto se distribuye cerrado) |
| ffmpeg | GPL (programa externo) |

Las tarjetas de licencia de cada voz están en `models/piper/*.MODEL_CARD.txt`.

## Estructura

```
ia/
├── main.py                 # FastAPI: CORS, errores, logs, /health, limpieza periódica
├── api/                    # rutas y dependencias
├── services/
│   ├── tutor.py            # orquestador: práctica de frases, conversación, resumen
│   ├── practice.py         # evaluación de frases/gramática, ánimos y saludos de Thommy
│   ├── speech_to_text.py   # ffmpeg + whisper.cpp + detección de silencio
│   ├── language_model.py   # cliente de Ollama (salidas JSON Schema)
│   ├── text_to_speech.py   # Piper + voz infantil + MP3
│   ├── pronunciation.py    # punto de extensión del evaluador fonético
│   └── session_manager.py  # sesiones (memoria + JSON)
├── prompts/                # personalidad, corrector y resumen (editables)
├── config/settings.py      # configuración por variables de entorno
├── scripts/                # setup, start, pruebas de componentes y calidad
└── tests/
```
