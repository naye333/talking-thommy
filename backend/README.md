# Talking Thommy – Backend

API REST y servidor WebSocket del tutor conversacional. Node.js + Express + ws + PostgreSQL (Neon).

## Requisitos

- Node.js 20 o superior
- Una base de datos en [Neon](https://neon.tech) (plan gratuito)

## Puesta en marcha

```bash
cd backend
npm install
cp .env.example .env      # luego pega tu DATABASE_URL de Neon
npm run dev
```

Verifica que todo esté arriba:

- REST: http://localhost:3000/api/salud
- WebSocket: `ws://localhost:3000/tiempo-real?sesion=ID`

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca con recarga automática |
| `npm start` | Arranca en modo normal (Render usa este) |
| `npm test` | Pruebas con cobertura (mínimo 80 % de líneas) |
| `npm run lint` | Revisa el estilo con StandardJS |

## Protocolo WebSocket

Conexión: `/tiempo-real?sesion=<id>&token=<jwt>` (el token se valida a partir de `feature/autenticacion`).

| Dirección | Mensaje | Significado |
|---|---|---|
| servidor → cliente | `{ "tipo": "conectado", "sesionId" }` | Conexión aceptada |
| cliente → servidor | `{ "tipo": "inicio_turno" }` | El estudiante empieza a hablar |
| cliente → servidor | *(binario)* | Trozos de audio |
| cliente → servidor | `{ "tipo": "fin_turno" }` | El estudiante terminó |
| servidor → cliente | `{ "tipo": "procesando" }` | Turno en proceso |
| servidor → cliente | `{ "tipo": "turno_recibido", "bytes" }` | Temporal: luego será transcripción, retroalimentación y respuesta del tutor |
| servidor → cliente | `{ "tipo": "error", "codigo" }` | Ver códigos abajo |

Códigos de error: `SESION_REQUERIDA`, `JSON_INVALIDO`, `TIPO_DESCONOCIDO`, `TURNO_NO_INICIADO`, `AUDIO_VACIO`, `AUDIO_DEMASIADO_GRANDE`, `ERROR_PROCESAMIENTO`.

## Estructura

```
src/
├── app.js                  # Express y rutas REST
├── servidor.js             # HTTP + WebSocket en el mismo puerto
├── config/                 # entorno y conexión a la BD
├── rutas/                  # una carpeta por recurso
└── tiempo-real/            # WebSocket y buffer de audio por turno
pruebas/                    # Jest + supertest
```

## Despliegue en Render

1. New → Web Service → conectar el repositorio.
2. Root directory: `backend` · Build: `npm install` · Start: `npm start`.
3. Variables de entorno: `DATABASE_URL`, `ORIGENES_PERMITIDOS`.

El plan gratuito se duerme tras 15 minutos sin uso; abre `/api/salud` un minuto antes de una demo.
