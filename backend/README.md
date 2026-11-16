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

## Conversación con Thommy (IA)

El tutor de IA vive en la carpeta [`ia/`](../ia/README.md) (Python: Whisper + Ollama + Piper) y corre como un servicio aparte en `URL_SERVICIO_IA` (por defecto `http://127.0.0.1:8000`). **Solo este backend lo llama**: la app nunca habla con la IA ni con Ollama.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/api/sesiones` (rol estudiante) | `{ temaId }` (`null` = conversación libre) | `201 { sesion: { id }, saludo: { texto, frase, audioUrl } }` |

Contrato completo (incluye `resultado_turno` y el audio): [`docs/contrato-api-perfil-estudiante.md`](../docs/contrato-api-perfil-estudiante.md).

| Variable | Por defecto | Para qué |
|---|---|---|
| `URL_SERVICIO_IA` | `http://127.0.0.1:8000` | Dónde corre el servicio de `ia/` |
| `CLAVE_SERVICIO_IA` | vacío | Igual a `API_KEY` de `ia/.env`, si se define |
| `TIEMPO_MAXIMO_IA_MS` | `90000` | Espera máxima por turno |

Probar sin la app (con el backend y la IA encendidos):

```bash
node scripts/probar-conversacion.js ../ia/tests/fixtures/student_sentence.webm
```

## Protocolo WebSocket

Conexión: `/tiempo-real?sesion=<id>&token=<jwt>`. Sin un token válido el servidor responde `TOKEN_INVALIDO` y cierra la conexión. La sesión debe haberse creado con `POST /api/sesiones` por el mismo estudiante; si no, responde `SESION_NO_ENCONTRADA` y cierra.

| Dirección | Mensaje | Significado |
|---|---|---|
| servidor → cliente | `{ "tipo": "conectado", "sesionId" }` | Conexión aceptada |
| cliente → servidor | `{ "tipo": "inicio_turno" }` | El estudiante empieza a hablar |
| cliente → servidor | *(binario)* | Trozos de audio |
| cliente → servidor | `{ "tipo": "fin_turno" }` | El estudiante terminó |
| servidor → cliente | `{ "tipo": "procesando" }` | Turno en proceso (Whisper → evaluación → Thommy → voz) |
| servidor → cliente | `{ "tipo": "resultado_turno", transcripcion, evaluacion, respuesta, correccion? }` | Resultado del turno con la voz de Thommy (ver contrato) |
| servidor → cliente | `{ "tipo": "error", "codigo" }` | Ver códigos abajo |

Códigos de error: `TOKEN_INVALIDO`, `SESION_REQUERIDA`, `SESION_NO_ENCONTRADA`, `JSON_INVALIDO`, `TIPO_DESCONOCIDO`, `TURNO_NO_INICIADO`, `AUDIO_VACIO`, `AUDIO_DEMASIADO_GRANDE`, `AUDIO_NO_ENTENDIDO`, `AUDIO_INVALIDO`, `TUTOR_NO_DISPONIBLE`, `ERROR_PROCESAMIENTO`.

## Estructura

```
src/
├── app.js                  # Express y rutas REST
├── servidor.js             # HTTP + WebSocket en el mismo puerto
├── config/                 # entorno y conexión a la BD
├── rutas/                  # una carpeta por recurso
├── servicios/
│   ├── servicioSesiones.js # sesiones con Thommy y adaptación al contrato de la app
│   └── servicioTutorIa.js  # cliente HTTP del servicio de IA (ia/)
└── tiempo-real/            # WebSocket y buffer de audio por turno
pruebas/                    # Jest + supertest (la IA se simula: no hace falta Ollama para npm test)
scripts/probar-conversacion.js  # prueba de punta a punta sin la app
```

## Despliegue en Render

1. New → Web Service → conectar el repositorio.
2. Root directory: `backend` · Build: `npm install` · Start: `npm start`.
3. Variables de entorno: `DATABASE_URL`, `ORIGENES_PERMITIDOS`, `JWT_SECRETO`, `ENTORNO=produccion` y `URL_SERVICIO_IA` (+ `CLAVE_SERVICIO_IA`).

> El servicio de IA necesita ~3 GB de RAM y CPU con AVX2: el plan gratuito de Render no alcanza. Debe correr en un servidor propio (ver [`ia/README.md`](../ia/README.md)) y el backend apuntar a él con `URL_SERVICIO_IA`, protegido con `CLAVE_SERVICIO_IA`.

El plan gratuito se duerme tras 15 minutos sin uso; abre `/api/salud` un minuto antes de una demo.
