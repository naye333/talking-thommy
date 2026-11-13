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
npm run migrar            # crea las tablas en la base de datos
npm run sembrar-syllabus  # carga el syllabus de Inglés I
npm run dev
```

Verifica que todo esté arriba:

- REST: http://localhost:3000/api/salud
- WebSocket: `ws://localhost:3000/tiempo-real?sesion=ID&token=JWT`

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca con recarga automática |
| `npm start` | Arranca en modo normal (Render usa este) |
| `npm test` | Pruebas con cobertura (mínimo 80 % de líneas) |
| `npm run lint` | Revisa el estilo con StandardJS |
| `npm run migrar` | Aplica las migraciones pendientes de `src/bd/migraciones` |
| `npm run crear-docente -- correo "Nombre" "clave"` | Crea una cuenta de docente |
| `npm run sembrar-syllabus [-- archivo.json]` | Carga o actualiza el syllabus (por defecto, Inglés I) |

## Autenticación

El registro público crea solo **estudiantes**. Las cuentas de docente se crean con `npm run crear-docente`.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/api/auth/registro` | `{ nombre, correo, contrasena, nivel }` (nivel 1 o 2) | `201 { token, usuario }` |
| POST | `/api/auth/ingreso` | `{ correo, contrasena }` | `200 { token, usuario }` |
| GET | `/api/auth/yo` | — (encabezado `Authorization: Bearer <token>`) | `200 { usuario }` |

Códigos de error: `DATOS_INVALIDOS` (400, con `detalles` por campo), `JSON_INVALIDO` (400), `CREDENCIALES_INVALIDAS` (401), `TOKEN_REQUERIDO` (401), `TOKEN_INVALIDO` (401), `PERMISO_DENEGADO` (403), `USUARIO_NO_ENCONTRADO` (404), `CORREO_EN_USO` (409), `BASE_DATOS_NO_DISPONIBLE` (503).

Las contraseñas se guardan cifradas con bcrypt y nunca se devuelven al cliente. Para proteger una ruta:

```js
router.get('/curso', exigirToken, exigirRol('docente'), controlador)
```

## Syllabus

El contenido vive en `src/bd/semillas/syllabus-ingles-1.json`, tomado de la planeación oficial de Inglés I (A1, 2026-2): 3 cortes y 10 temas. Según el Acta, no se edita desde la app: para cambiarlo se modifica el JSON y se vuelve a ejecutar `npm run sembrar-syllabus` (actualiza sin duplicar). Para Inglés II, crea `syllabus-ingles-2.json` con la misma estructura y `"nivel": 2`.

> El vocabulario y las frases modelo de cada tema son una propuesta del equipo, pendiente de validación por el profesor.

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/syllabus` | `{ nivel, unidades: [{ id, numero, titulo, descripcion, temas: [{ id, numero, semana, titulo }] }] }` |
| GET | `/api/syllabus?nivel=2` | Igual, para otro nivel (obligatorio para docentes) |
| GET | `/api/syllabus/temas/:id` | `{ tema: { id, nivel, semana, titulo, objetivo, gramatica, vocabulario, frasesModelo, ... } }` |

Todas exigen `Authorization: Bearer <token>`. Si un estudiante no envía `?nivel`, se usa el de su cuenta. Errores: `DATOS_INVALIDOS` (400), `TEMA_NO_ENCONTRADO` (404).

## Protocolo WebSocket

Conexión: `/tiempo-real?sesion=<id>&token=<jwt>`. Sin un token válido el servidor responde `TOKEN_INVALIDO` y cierra la conexión.

| Dirección | Mensaje | Significado |
|---|---|---|
| servidor → cliente | `{ "tipo": "conectado", "sesionId" }` | Conexión aceptada |
| cliente → servidor | `{ "tipo": "inicio_turno" }` | El estudiante empieza a hablar |
| cliente → servidor | *(binario)* | Trozos de audio |
| cliente → servidor | `{ "tipo": "fin_turno" }` | El estudiante terminó |
| servidor → cliente | `{ "tipo": "procesando" }` | Turno en proceso |
| servidor → cliente | `{ "tipo": "turno_recibido", "bytes" }` | Temporal: luego será transcripción, retroalimentación y respuesta del tutor |
| servidor → cliente | `{ "tipo": "error", "codigo" }` | Ver códigos abajo |

Códigos de error: `TOKEN_INVALIDO`, `SESION_REQUERIDA`, `JSON_INVALIDO`, `TIPO_DESCONOCIDO`, `TURNO_NO_INICIADO`, `AUDIO_VACIO`, `AUDIO_DEMASIADO_GRANDE`, `ERROR_PROCESAMIENTO`.

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
3. Variables de entorno: `DATABASE_URL`, `ORIGENES_PERMITIDOS`, `JWT_SECRETO` y `ENTORNO=produccion`.

El plan gratuito se duerme tras 15 minutos sin uso; abre `/api/salud` un minuto antes de una demo.
