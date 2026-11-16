# Contrato API · Perfil estudiante

> **Para el equipo de backend e IA.** El frontend está construido sobre este contrato. La conversación con Thommy ya usa la IA real (`modoConversacion: 'tiempoReal'`, rama `feature/ia-tutor`). En `frontend/js/config.js`:
> - `modoConversacion: 'tiempoReal'` → conversación real (por defecto); `'ejemplo'` → tutor simulado sin backend.
> - `usarDatosEjemploProgreso: false` → progreso real.
> - `usarDatosEjemploDocente: false` → perfil docente real (ver `propuesta-api-perfil-docente.md`).

## Ya existente (el frontend lo usa tal cual)

| Uso | Endpoint |
|---|---|
| Registro | `POST /api/auth/registro` `{ nombre, correo, contrasena, nivel }` |
| Ingreso | `POST /api/auth/ingreso` |
| Cuenta | `GET /api/auth/yo` |
| Lecciones | `GET /api/syllabus?nivel=N`, `GET /api/syllabus/temas/:id` |

## Conversación con Thommy

### 1. Crear la sesión de práctica ✅ implementado (`feature/ia-tutor`)

`POST /api/sesiones` · `Authorization: Bearer <token>` · rol `estudiante`

```json
// Cuerpo
{ "temaId": 3 }            // null = conversación libre

// 201
{
  "sesion": { "id": "abc123" },
  "saludo": {
    "texto": "Hi Ana! I'm Thommy! Today we're going to practice \"Introducing yourself\". This is gonna be awesome! Try saying this:",
    "frase": "Hi, let me introduce myself.",   // frase que el estudiante debe decir (null en conversación libre)
    "audioUrl": "data:audio/mpeg;base64,SUQz…" // voz de Thommy diciendo texto + frase
  }
}
```

- **Con tema** (`temaId`): Thommy pide repetir las `frasesModelo` del tema, en orden. Si el estudiante dice otra cosa, conversa con él y vuelve a la frase. Al terminar las frases, sigue en conversación libre sobre el tema.
- **Sin tema**: conversación libre; Thommy hace preguntas y corrige la gramática.
- Errores: `400 DATOS_INVALIDOS` (temaId), `404 TEMA_NO_ENCONTRADO`, `503 TUTOR_NO_DISPONIBLE` (servicio de IA apagado).

### 2. WebSocket `/tiempo-real?sesion=<id>&token=<jwt>` ✅ implementado

La sesión debe haberse creado con `POST /api/sesiones` por el mismo estudiante; si no, el servidor envía `SESION_NO_ENCONTRADA` y cierra.

| Dirección | Mensaje | Estado |
|---|---|---|
| servidor → cliente | `{ "tipo": "conectado", "sesionId" }` | Existe |
| cliente → servidor | `{ "tipo": "inicio_turno" }` | Existe |
| cliente → servidor | binario: trozos de audio cada 250 ms (`audio/webm;codecs=opus`; en iOS `audio/mp4`) | Existe |
| cliente → servidor | `{ "tipo": "fin_turno" }` | Existe |
| servidor → cliente | `{ "tipo": "procesando" }` | Existe |
| servidor → cliente | **`{ "tipo": "resultado_turno", ... }`** (abajo) | **Nuevo**: reemplaza a `turno_recibido` |
| servidor → cliente | `{ "tipo": "error", "codigo" }` | Existe |

Para cancelar un turno el cliente no envía nada: el siguiente `inicio_turno` descarta el audio anterior (ya funciona así).

```json
{
  "tipo": "resultado_turno",
  "transcripcion": "Hi, let me in produce myself.",
  "evaluacion": {
    "tipo": "frase",                     // "frase" (repitió la frase modelo) | "gramatica" (habló libremente)
    "etiqueta": "Palabras entendidas",   // nombre del puntaje para mostrar ("Palabras entendidas" | "Gramática")
    "puntaje": 80,                       // 0-100
    "nivel": "bien",                     // "excelente" | "bien" | "practicar"
    "mensaje": "Casi perfecto. Thommy no entendió bien \"introduce\": repítela despacio.",   // en español
    "palabras": [
      { "texto": "Hi,", "correcta": true },
      { "texto": "introduce", "correcta": false, "sugerencia": "Repite despacio: \"introduce\"" }
    ]
  },
  "respuesta": {
    "texto": "Good job! Almost perfect! Listen and say it slowly:",   // intervención del tutor, en inglés
    "frase": "Hi, let me introduce myself.",   // frase a practicar (null en conversación libre)
    "audioUrl": "data:audio/mpeg;base64,SUQz…"  // voz de Thommy (ver abajo)
  },
  "correccion": {                        // opcional: solo si hubo un error de gramática
    "original": "Yesterday I go to school.",
    "corregida": "Yesterday I went to school."
  }
}
```

**Cómo se calcula `evaluacion`** (servicio de IA, `ia/services/practice.py`):

- `tipo: "frase"`: se compara lo que entendió Whisper con la frase que Thommy pidió decir, palabra por palabra.
  Mide si el sistema **entendió** cada palabra (inteligibilidad). **No es un análisis fonético**: Whisper a veces
  "corrige" palabras mal pronunciadas, así que el puntaje puede ser generoso. Es una medida provisional hasta
  tener el evaluador fonético que pide el acta (`ia/services/pronunciation.py` es el punto de extensión).
- `tipo: "gramatica"`: el estudiante habló libremente; se marcan las palabras que el corrector cambió.

### Audio del tutor (`audioUrl`) · ✅ acordado e implementado

| Tema | Decisión |
|---|---|
| Formato | **MP3** mono 64 kbps (~8 KB por segundo de voz). Se reproduce en Chrome, el WebView de Android y iOS. |
| Tipo de URL | **Audio embebido** (`data:audio/mpeg;base64,…`) dentro del mismo mensaje. No hay URL que vencer, no necesita token ni otra petición, y no hay problema de contenido mixto en `https://localhost` (Android). |
| Contenido | El audio dice **`texto` + `frase`**, igual que la voz del dispositivo. |
| Saludo | `saludo.audioUrl` de `POST /api/sesiones` también trae la voz. |
| Voz | Voz infantil de Thommy (Piper `en_US-kristin-medium` con el tono subido). Se configura en `ia/.env`. |
| Reproducción | La app reproduce el saludo y cada respuesta **automáticamente**; 🔊 vuelve a reproducirla. Si el dispositivo bloquea el audio, usa su propia voz. |

`voz.js` acepta `http`, `https` y `data:audio/...;base64`. Validado con audio real del servidor (ver `backend/scripts/probar-conversacion.js`).

**Tiempos medidos** (PC de desarrollo, 8 GB, sin GPU): crear sesión ≈ 3 s; turno repitiendo la frase ≈ 5-8 s; turno de conversación libre ≈ 15 s. Por eso `tiempoMaximoRespuestaMs` es 90 000 en `js/config.js`.

Errores que el frontend traduce: `TOKEN_INVALIDO`, `SESION_REQUERIDA`, `SESION_NO_ENCONTRADA`, `AUDIO_VACIO`, `AUDIO_DEMASIADO_GRANDE`, `AUDIO_NO_ENTENDIDO` (silencio o voz no reconocible), `AUDIO_INVALIDO`, `TURNO_NO_INICIADO`, `TUTOR_NO_DISPONIBLE`, `ERROR_PROCESAMIENTO`.

## Progreso del estudiante (nuevo)

`GET /api/estudiante/progreso?periodo=ultima_semana|ultimo_mes|semestre` · rol `estudiante`

```json
{
  "periodo": "ultimo_mes",
  "promedioGeneral": 79,
  "variacion": 3,
  "areas": [{ "clave": "pronunciacion", "nombre": "Pronunciación", "valor": 82 }],
  "evolucion": [{ "etiqueta": "Sem 1", "valor": 66 }, { "etiqueta": null, "valor": 70 }],
  "fortalezas": ["Buen desempeño en Pronunciación"],
  "areasMejorar": ["Gramática", "Fluidez"]
}
```

Mismo cálculo que el reporte del docente (`GET /api/docente/estudiantes/:id/reporte` + `/detalle`), pero para el estudiante del token.

## Dónde se conecta en el frontend

| Archivo | Qué cambiar |
|---|---|
| `js/servicios/estudiante/servicioConversacion.js` | Nada: el modo `tiempoReal` ya implementa este contrato |
| `js/servicios/estudiante/servicioProgreso.js` | Reemplazar los datos de ejemplo por `cliente.get('/api/estudiante/progreso?periodo=...')` |
