# API del servicio de IA de Talking Thommy

> **En este repositorio, quien llama a esta API es el backend de Node** (`backend/src/servicios/servicioTutorIa.js`),
> no la app. La app usa el contrato de [`docs/contrato-api-perfil-estudiante.md`](../../docs/contrato-api-perfil-estudiante.md).
>
> **Novedades para la app (rama `feature/ia-tutor`):**
> - `POST /session/start` acepta `lesson: { title, objective, grammar[], vocabulary[], model_phrases[] }` y devuelve `phrase`
>   (frase a practicar). Sin `lesson`, conversación libre (`phrase: null`). El saludo ya no usa el modelo (≈ 3 s).
> - `POST /conversation/audio` devuelve además `phrase` (siguiente frase) y `evaluation`:
>   `{ kind: "phrase"|"grammar", label_es, score, level: "excelente"|"bien"|"practicar", message_es, words: [{ text, ok, hint_es }], target_phrase }`.
> - El audio de Thommy es **MP3** (`audio.format = "mp3"`, `audio.mime_type = "audio/mpeg"`) con voz infantil, y dice
>   `reply` + `phrase`. Los ejemplos de abajo con `.wav` corresponden a `AUDIO_FORMAT=wav`.

- **URL base (desarrollo):** `http://127.0.0.1:8000`
- **Swagger interactivo:** `GET /docs` · **OpenAPI JSON:** `GET /openapi.json`
- **Formato:** JSON (UTF-8). El audio del estudiante se envía como `multipart/form-data`.
- **Autenticación (opcional):** si el servidor define `API_KEY`, enviar la cabecera `X-API-Key: <clave>`
  en todas las rutas excepto `/health`, `/docs` y `/audio/...`.
- **CORS:** el origen del frontend debe estar en `CORS_ORIGINS` del servidor.
- **Tiempos:** una petición con audio tarda ~9–15 s en el PC de desarrollo. Use timeouts de **≥ 120 s**
  y muestre una animación de "Thommy está pensando" en el avatar.

## Flujo típico

```
1. POST /session/start          → session_id + saludo (texto + audio)   → reproducir saludo
2. (repetir) POST /conversation/audio  (o /conversation/text)            → reproducir respuesta
3. GET  /session/{id}/progress  (cuando se quiera mostrar el avance)
4. POST /session/end            → resumen del aprendizaje
```

Una sesión procesa **una petición a la vez**; espere la respuesta antes de enviar el siguiente audio.

---

## POST /session/start

Inicia una sesión y devuelve el saludo de Thommy.

**Petición**
```json
{
  "student_id": "student-001",
  "level": "A2",
  "topic": "school",
  "learning_goal": "Talk about yesterday using the past simple",
  "student_name": "Ana",
  "voice": null,
  "include_audio_base64": false
}
```
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `student_id` | string (1–64, `A-Z a-z 0-9 _ . - @`) | sí | Identificador del estudiante en su sistema |
| `level` | `A1` `A2` `B1` `B2` `C1` `C2` | sí | Nivel MCER |
| `topic` | string ≤ 200 | no (`daily life`) | Tema de conversación |
| `learning_goal` | string ≤ 300 | no | Objetivo de la sesión |
| `student_name` | string ≤ 60 | no | Thommy lo usa para saludar |
| `voice` | string | no | Voz de Piper instalada (por defecto la del servidor) |
| `include_audio_base64` | bool | no | Incluir el WAV en base64 además de la URL |

**Respuesta 200**
```json
{
  "session_id": "fc980cfe4d791513f99ea5b8b98538a6",
  "student_id": "student-001",
  "level": "A2",
  "topic": "school",
  "learning_goal": "Talk about yesterday using the past simple",
  "voice": "en_US-joe-medium",
  "greeting": "Hi Ana! I'm Thommy, a friendly English teacher. Let's practice talking about school today. What do you like to do at school?",
  "audio": {
    "url": "/audio/fc980cfe4d791513f99ea5b8b98538a6/000-33ed12ed.wav",
    "format": "wav",
    "sample_rate": 22050,
    "duration_seconds": 7.9,
    "voice": "en_US-joe-medium",
    "base64": null
  },
  "created_at": "2026-11-07T21:12:50.120Z"
}
```

---

## POST /conversation/audio

Flujo completo: **audio → Whisper → corrector → Thommy → Piper**.

**Petición** `multipart/form-data`
| Campo | Tipo | Notas |
|---|---|---|
| `session_id` | texto | De `/session/start` |
| `audio` | archivo | `wav, mp3, m4a, webm, ogg, oga, flac, mp4, aac` · máx. 10 MB · 0,3–60 s |
| `include_audio_base64` | `true`/`false` | Opcional |

`MediaRecorder` del navegador (webm/opus) funciona directamente; no hace falta convertir.

**Respuesta 200**
```json
{
  "session_id": "fc980cfe4d791513f99ea5b8b98538a6",
  "turn": 1,
  "transcription": "Yesterday I go to the school with my friends.",
  "reply": "That sounds fun! By the way, we say: Yesterday I went to the school with my friends. What did your friend do yesterday?",
  "correction": {
    "original": "Yesterday I go to the school with my friends.",
    "corrected": "Yesterday I went to the school with my friends.",
    "explanation": "For past actions, use the simple past tense."
  },
  "audio": {
    "url": "/audio/fc980cfe4d791513f99ea5b8b98538a6/001-8e823255.wav",
    "format": "wav",
    "sample_rate": 22050,
    "duration_seconds": 7.59,
    "voice": "en_US-joe-medium",
    "base64": null
  },
  "pronunciation": {
    "available": false,
    "score": null,
    "details": [],
    "note": "Pronunciation is not evaluated from transcripts."
  },
  "timings": {
    "speech_to_text_ms": 4802,
    "grammar_check_ms": 4580,
    "language_model_ms": 3181,
    "text_to_speech_ms": 1962,
    "total_ms": 14568
  }
}
```
| Campo | Uso sugerido en la app |
|---|---|
| `transcription` | Mostrar "Tú dijiste: …" (ayuda al estudiante a ver qué entendió el sistema) |
| `reply` | Subtítulo de Thommy / burbuja de diálogo |
| `audio.url` | Reproducir la voz de Thommy y animar el avatar durante `audio.duration_seconds` |
| `correction` | `null` si no hubo error. Si existe, se puede resaltar visualmente |
| `pronunciation` | Hoy siempre `available: false` (reservado para una versión futura) |
| `timings` | Diagnóstico de rendimiento |

---

## POST /conversation/text

Igual que el anterior pero con texto (pruebas sin micrófono o modo chat).

```json
{ "session_id": "fc980cfe4d791513f99ea5b8b98538a6", "message": "We play football and then we eat lunch together.", "include_audio": true, "include_audio_base64": false }
```
Respuesta: mismo formato que `/conversation/audio` (`speech_to_text_ms` = `null`; si
`include_audio=false`, `audio` = `null`).

---

## GET /audio/{session_id}/{archivo}.wav

Descarga el WAV de Thommy (`audio/wav`, mono, 22 050 Hz). No requiere API key para poder usarse
directamente en `<audio src>`. La URL no es adivinable. Los audios se borran tras
`AUDIO_RETENTION_MINUTES` (120 min por defecto) → `404`.

---

## GET /session/{session_id}/progress

```json
{
  "session_id": "fc980cfe4d791513f99ea5b8b98538a6",
  "student_id": "student-001",
  "level": "A2",
  "topic": "school",
  "learning_goal": "Talk about yesterday using the past simple",
  "status": "active",
  "started_at": "2026-11-07T21:12:50.120Z",
  "last_activity_at": "2026-11-07T21:13:38.102Z",
  "duration_seconds": 48,
  "student_turns": 2,
  "student_words": 18,
  "audio_turns": 1,
  "corrections": [
    { "original": "Yesterday I go to the school with my friends.", "corrected": "Yesterday I went to the school with my friends.", "explanation": "For past actions, use the simple past tense." }
  ],
  "history": [
    { "index": 0, "role": "thommy",  "text": "Hi Ana! ... What do you like to do at school?", "timestamp": "...", "source": "system", "correction": null },
    { "index": 1, "role": "student", "text": "Yesterday I go to the school with my friends.", "timestamp": "...", "source": "audio", "correction": { "...": "..." } },
    { "index": 2, "role": "thommy",  "text": "That sounds fun! By the way, we say: ...", "timestamp": "...", "source": "text", "correction": null }
  ],
  "practice_summary": "2 speaking turn(s), 18 words spoken about 'school' at level A2. 1 correction(s) so far.",
  "feedback_available": true
}
```
`duration_seconds` cuenta desde el inicio hasta ahora (o hasta el final si `status` = `ended`).

---

## POST /session/end

```json
{ "session_id": "fc980cfe4d791513f99ea5b8b98538a6" }
```
**Respuesta 200**
```json
{
  "session_id": "fc980cfe4d791513f99ea5b8b98538a6",
  "status": "ended",
  "duration_seconds": 68,
  "student_turns": 2,
  "student_words": 18,
  "summary": {
    "summary": "You practiced speaking about school in 2 turns and said 18 words. Keep practicing this: For past actions, use the simple past tense.",
    "strengths": ["You gave details about your day with your friends."],
    "areas_to_improve": ["For past actions, use the simple past tense. Example: \"Yesterday I went to the school with my friends.\""],
    "corrections": [ { "original": "...", "corrected": "...", "explanation": "..." } ],
    "vocabulary": ["went", "played", "lunch"],
    "next_steps": ["Practice using the past simple to describe your last weekend."],
    "pronunciation": { "available": false, "score": null, "details": [], "note": "Pronunciation is not evaluated from transcripts." }
  }
}
```
Después de finalizar, `/conversation/*` devuelve `409 session_ended`; `/progress` sigue disponible.

---

## GET /health

```json
{ "status": "ok", "components": {
  "language_model": { "ok": true, "model": "qwen3:1.7b", "installed_models": ["qwen3:1.7b", "qwen2.5:1.5b"] },
  "speech_to_text": { "ok": true, "whisper_bin": true, "model": "ggml-base.en.bin", "ffmpeg": true },
  "text_to_speech": { "ok": true, "default_voice": "en_US-joe-medium", "voices": ["en_US-joe-medium"] } } }
```
`status: "degraded"` indica qué motor falta.

---

## Errores

Todos los errores tienen el formato `{"error": "<código>", "detail": "<mensaje en inglés>"}`.

| HTTP | `error` | Cuándo | Qué hacer en la app |
|---|---|---|---|
| 400 | `invalid_audio` | Formato no permitido, archivo corrupto, audio < 0,3 s o > 60 s | Pedir que grabe de nuevo |
| 400 | `invalid_voice` | `voice` con una voz no instalada (omitir el campo o enviar `null` = voz por defecto) | Quitar `voice` |
| 401 | `unauthorized` | Falta/incorrecta `X-API-Key` | Revisar configuración |
| 404 | `session_not_found` | `session_id` inexistente o audio expirado | Iniciar nueva sesión |
| 409 | `session_ended` | La sesión ya terminó | Iniciar nueva sesión |
| 413 | `audio_too_large` | Archivo > `MAX_UPLOAD_MB` | Grabaciones más cortas |
| 422 | `speech_not_recognized` | Silencio o voz no entendible | Thommy: "No te escuché, ¿puedes repetir?" |
| 422 | `validation_error` | Datos JSON inválidos (p. ej. nivel `Z9`) | Corregir la petición |
| 503 | `engine_unavailable` | Ollama/Whisper/Piper/ffmpeg no disponible | Reintentar; revisar `/health` |
| 500 | `internal_error` | Error inesperado (ver `logs/thommy.log`) | Reintentar |

---

## Ejemplo en JavaScript (navegador)

```js
const API = "http://127.0.0.1:8000";

// 1) Iniciar sesión
const start = await fetch(`${API}/session/start`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ student_id: "student-001", level: "A2", topic: "school", student_name: "Ana" }),
}).then(r => r.json());
const sessionId = start.session_id;
new Audio(API + start.audio.url).play();          // voz del saludo

// 2) Grabar al estudiante y enviar
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const rec = new MediaRecorder(stream);            // produce audio/webm (opus)
const chunks = [];
rec.ondataavailable = e => chunks.push(e.data);
rec.onstop = async () => {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("audio", new Blob(chunks, { type: "audio/webm" }), "answer.webm");
  const res = await fetch(`${API}/conversation/audio`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) { console.warn(data.error, data.detail); return; }   // p. ej. speech_not_recognized
  showSubtitles(data.transcription, data.reply, data.correction);
  const voice = new Audio(API + data.audio.url);
  voice.onplay = () => avatar.startTalking();
  voice.onended = () => avatar.stopTalking();
  voice.play();
};
rec.start();  /* ... */  rec.stop();

// 3) Finalizar
const end = await fetch(`${API}/session/end`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ session_id: sessionId }),
}).then(r => r.json());
```

## Ejemplo con curl

```bash
curl -X POST http://127.0.0.1:8000/session/start -H "Content-Type: application/json" -d "{\"student_id\":\"s1\",\"level\":\"B1\",\"topic\":\"travel\"}"
curl -X POST http://127.0.0.1:8000/conversation/audio -F session_id=<ID> -F audio=@grabacion.webm
curl -X POST http://127.0.0.1:8000/conversation/text -H "Content-Type: application/json" -d "{\"session_id\":\"<ID>\",\"message\":\"I have visited London last year.\"}"
curl http://127.0.0.1:8000/session/<ID>/progress
curl -X POST http://127.0.0.1:8000/session/end -H "Content-Type: application/json" -d "{\"session_id\":\"<ID>\"}"
```

Un cliente completo en Python está en `scripts/demo_client.py`.
