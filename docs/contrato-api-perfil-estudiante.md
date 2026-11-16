# Contrato API · Perfil estudiante

> **Para el equipo de backend e IA.** El frontend ya está construido sobre este contrato y hoy usa respuestas simuladas. Al implementarlo, basta con cambiar en `frontend/js/config.js`:
> - `modoConversacion: 'tiempoReal'` → conversación real.
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
    "texto": "Well done! Now try this one:",   // intervención del tutor, en inglés
    "frase": "I am friendly and funny.",       // siguiente frase a practicar (opcional)
    "audioUrl": null                           // opcional: audio del tutor; si falta, el frontend usa la voz del dispositivo
  }
}
```

Mientras el backend responda `turno_recibido`, el frontend en modo `tiempoReal` muestra "Thommy todavía no puede responder" (`TUTOR_NO_DISPONIBLE`).

### Audio del tutor (`respuesta.audioUrl`) · ⚠️ pendiente de acordar

**Lo que ya hace el frontend** (`js/servicios/estudiante/voz.js`): al tocar 🔊 en un mensaje de Thommy, reproduce `audioUrl` si existe; si falta, no carga o el dispositivo bloquea la reproducción, lee el texto con la voz del dispositivo. Acepta URLs absolutas o relativas a `urlApi` y solo `http`/`https`.

**Falta acordar con backend (Gabriela) e IA (Alisson)** y dejarlo escrito aquí:

| Tema | Pregunta | Por qué importa en el frontend |
|---|---|---|
| Formato | ¿MP3, WAV, OGG/Opus? ¿Tamaño o duración máxima? | Debe reproducirse en Chrome y en el WebView de Android (iOS no reproduce OGG). |
| Protocolo | ¿Siempre `https`? | La app Android se sirve como `https://localhost`: un audio `http` se bloquea por contenido mixto. |
| Tipo de URL | ¿Absoluta (almacenamiento externo) o relativa a la API? ¿Pública o firmada y temporal? ¿Cuánto tiempo es válida? | El elemento `<audio>` **no puede enviar** `Authorization: Bearer`; si el audio exige el token, no se podrá reproducir. Una URL vencida cae a la voz del dispositivo. |
| Contenido | ¿El audio lee `texto` + `frase` juntos, como hoy la voz del dispositivo? | Para que ambas opciones digan lo mismo. |
| Saludo | ¿`saludo` de `POST /api/sesiones` también tendrá `audioUrl`? | El frontend ya lo soportaría sin cambios. |

**Pendiente de validación:** la reproducción con un audio real del servidor no se ha probado; solo hay pruebas con un audio simulado y una prueba en Chrome de la caída a la voz del dispositivo (audio inexistente, 404). Se validará cuando backend e IA tengan la integración disponible, en navegador y en un celular Android.

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
