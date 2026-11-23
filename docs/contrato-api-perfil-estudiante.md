# Contrato API · Perfil estudiante

> **Estado: implementado** en el backend (ver `backend/README.md`) y activado en `frontend/js/config.js` (`modoConversacion: 'tiempoReal'`, `usarDatosEjemploProgreso: false`, `usarDatosEjemploDocente: false`). Para volver a los datos simulados, usa `'ejemplo'` y `true`.

## Ya existente (el frontend lo usa tal cual)

| Uso | Endpoint |
|---|---|
| Registro | `POST /api/auth/registro` `{ nombre, correo, contrasena, nivel }` |
| Ingreso | `POST /api/auth/ingreso` |
| Cuenta | `GET /api/auth/yo` |
| Lecciones | `GET /api/syllabus?nivel=N`, `GET /api/syllabus/temas/:id` |

## Conversación con Thommy

### 1. Crear la sesión de práctica (nuevo)

`POST /api/sesiones` · `Authorization: Bearer <token>` · rol `estudiante`

```json
// Cuerpo
{ "temaId": 3 }            // null = conversación libre

// 201
{
  "sesion": { "id": "abc123" },
  "saludo": {
    "texto": "Hi! I'm Thommy. Today we will practice \"Introducing yourself\". Try saying this:",
    "frase": "Hi, let me introduce myself."   // frase que el estudiante debe decir (opcional)
  }
}
```

### 2. WebSocket `/tiempo-real?sesion=<id>&token=<jwt>` (existente, se completa la respuesta)

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
  "transcripcion": "Hi, let me introduce myself.",
  "evaluacion": {
    "puntaje": 68,                       // 0-100
    "nivel": "practicar",                // "excelente" | "bien" | "practicar"
    "mensaje": "Casi perfecto. Practica la palabra \"introduce\".",   // en español, para A1
    "palabras": [
      { "texto": "Hi,", "correcta": true },
      { "texto": "introduce", "correcta": false, "sugerencia": "Repite despacio: \"introduce\"" }
    ]
  },
  "respuesta": {
    "texto": "Oh, you are from Bogota! Do you like it?",  // lo que dice Thommy, en inglés (conversación sobre el tema)
    "frase": null,                                         // ya no se usa: Thommy conversa, no pide frases para repetir
    "audioUrl": "/api/voz/3f2c…"                           // voz de Thommy (Piper); null si el servidor no tiene Piper
  }
}
```

Mientras el backend responda `turno_recibido`, el frontend en modo `tiempoReal` muestra "Thommy todavía no puede responder" (`TUTOR_NO_DISPONIBLE`).

### Voz de Thommy (`audioUrl`)

El servidor genera la voz de niño de Thommy con **Piper** (texto a voz libre, en el propio servidor) y la entrega en `GET /api/voz/:id`:

| Tema | Decisión |
|---|---|
| Formato | WAV PCM 16 bits mono (voz `en_US-kristin-medium` con el tono subido 1.28×). Unos 56 KB por segundo de voz. |
| Tipo de URL | Relativa a la API (`/api/voz/<uuid>`), sin token: el `<audio>` no puede enviar `Authorization`. El id es aleatorio y vence a los 10 minutos. |
| Cuándo está listo | La respuesta del turno llega sin esperar el audio; el `GET` espera a que Piper termine. Si Piper falla responde `503` y la app usa la voz del dispositivo. |
| Contenido | El audio lee `texto` (ya no hay `frase`). |
| Saludo | `saludo` de `POST /api/sesiones` también trae `audioUrl`. |
| Sin Piper | `audioUrl` es `null` y la app usa la voz del dispositivo. `GET /api/salud` → `voz.motor` dice `piper` o `navegador`. |

**Lo que hace el frontend** (`js/servicios/estudiante/voz.js` y la pantalla de conversación): Thommy **habla solo** al saludar y en cada respuesta, sin tocar 🔊 (el botón queda para volver a escucharlo). Si `audioUrl` falta, no carga o el dispositivo bloquea la reproducción, lee el texto con la voz del dispositivo.

**Probado:** en Chrome con el servidor local, el saludo se reproduce solo con la voz de Piper. **Falta probar** en un celular Android (el WebView puede exigir un toque antes de reproducir audio).

Errores que el frontend ya traduce: `TOKEN_INVALIDO`, `SESION_REQUERIDA`, `AUDIO_VACIO`, `AUDIO_DEMASIADO_GRANDE`, `TURNO_NO_INICIADO`, `ERROR_PROCESAMIENTO`.

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
