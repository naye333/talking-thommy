# Talking Thommy – Backend

API REST y servidor WebSocket del tutor conversacional. Node.js + Express + ws + PostgreSQL (Neon).

## Requisitos

- Node.js 20 o superior
- Una base de datos en [Neon](https://neon.tech) (plan gratuito)

## Puesta en marcha

```bash
cd backend
npm install
cp .env.example .env      # luego pega tu DATABASE_URL de Neon y tu GROQ_API_KEY
npm run migrar            # crea las tablas en la base de datos
npm run sembrar-syllabus  # carga el syllabus de Inglés I y la propuesta de Inglés II
npm run crear-docente -- profe@usta.edu.co "Nombre" "contrasena"   # muestra el código de grupo
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
| `npm run sembrar-syllabus [-- archivo.json]` | Carga o actualiza el syllabus (por defecto, todos los `semillas/syllabus-*.json`) |
| `npm run asignar-docente -- correoDocente correoEstudiante...` | Asigna estudiantes a un docente (alternativa al código de grupo) |
| `npm run restablecer-contrasena -- correo "NuevaContrasena"` | Cambia la contraseña de cualquier cuenta (por ejemplo, si el docente olvidó la suya) |
| `npm run medir-calidad -- carpeta [--con-tutor]` | Mide la precisión de la transcripción y la latencia con audios reales (ver `docs/metricas-calidad.md`) |

## Autenticación

El registro público crea solo **estudiantes**. Las cuentas de docente se crean con `npm run crear-docente`.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/api/auth/registro` | `{ nombre, correo, contrasena, nivel, codigoGrupo? }` (nivel 1 o 2) | `201 { token, usuario }` |
| POST | `/api/auth/ingreso` | `{ correo, contrasena }` | `200 { token, usuario }` |
| GET | `/api/auth/yo` | — (encabezado `Authorization: Bearer <token>`) | `200 { usuario }` |
| PATCH | `/api/auth/contrasena` | `{ contrasenaActual, contrasenaNueva }` | `204` |

Códigos de error: `DATOS_INVALIDOS` (400, con `detalles` por campo), `JSON_INVALIDO` (400), `CONTRASENA_INCORRECTA` (400), `CODIGO_GRUPO_INVALIDO` (400), `CREDENCIALES_INVALIDAS` (401), `TOKEN_REQUERIDO` (401), `TOKEN_INVALIDO` (401), `PERMISO_DENEGADO` (403), `USUARIO_NO_ENCONTRADO` (404), `CORREO_EN_USO` (409), `DEMASIADOS_INTENTOS` (429), `BASE_DATOS_NO_DISPONIBLE` (503).

**Límite de intentos:** registro, ingreso y cambio de contraseña aceptan 10 intentos **fallidos** por IP cada 15 minutos (`MAX_INTENTOS_AUTH`). Los intentos exitosos no cuentan.

### Grupo docente-estudiantes

Cada docente tiene un **código de grupo** de 6 caracteres, sin letras que se confundan (0/O, 1/I/L). El estudiante lo escribe al registrarse (`codigoGrupo`) o después:

| Método | Ruta | Rol | Respuesta |
|---|---|---|---|
| GET | `/api/estudiante/grupo` | estudiante | `{ docente: { id, nombre } \| null }` |
| POST | `/api/estudiante/grupo` | estudiante | Cuerpo `{ codigo }` → `{ docente }` |
| GET | `/api/docente/grupo` | docente | `{ codigo }` |
| POST | `/api/docente/grupo/codigo` | docente | `{ codigo }` nuevo (los estudiantes ya unidos se mantienen) |

### Contraseña olvidada

- **Estudiante:** su docente genera una contraseña temporal con `POST /api/docente/estudiantes/:id/contrasena-temporal` → `{ estudiante, contrasenaTemporal }`. Luego el estudiante la cambia en su perfil.
- **Docente:** `npm run restablecer-contrasena -- correo "NuevaContrasena"`.

No hay recuperación por correo porque el proyecto no tiene un servicio de envío de correos.

Las contraseñas se guardan cifradas con bcrypt y nunca se devuelven al cliente. Para proteger una ruta:

```js
router.get('/curso', exigirToken, exigirRol('docente'), controlador)
```

## Syllabus

El contenido vive en `src/bd/semillas/`. Según el Acta, no se edita desde la app: para cambiarlo se modifica el JSON y se vuelve a ejecutar `npm run sembrar-syllabus` (actualiza sin duplicar).

- `syllabus-ingles-1.json`: tomado de la planeación oficial de Inglés I (A1, 2026-2), con 3 cortes y 10 temas. El vocabulario y las frases modelo son una propuesta del equipo.
- `syllabus-ingles-2.json`: **propuesta completa del equipo** para Inglés II (A2), con 3 cortes y 9 temas, para que los estudiantes de nivel 2 puedan practicar. Hay que reemplazarla con la planeación oficial cuando el profesor la entregue: basta con editar el JSON y volver a sembrar.

> Todo el contenido marcado como propuesta está pendiente de validación por el profesor.

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/syllabus` | `{ nivel, unidades: [{ id, numero, titulo, descripcion, temas: [{ id, numero, semana, titulo }] }] }` |
| GET | `/api/syllabus?nivel=2` | Igual, para otro nivel (obligatorio para docentes) |
| GET | `/api/syllabus/temas/:id` | `{ tema: { id, nivel, semana, titulo, objetivo, gramatica, vocabulario, frasesModelo, ... } }` |

Todas exigen `Authorization: Bearer <token>`. Si un estudiante no envía `?nivel`, se usa el de su cuenta. Errores: `DATOS_INVALIDOS` (400), `TEMA_NO_ENCONTRADO` (404).

## Sesiones de práctica

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/api/sesiones` (rol estudiante) | `{ temaId }` (`null` = conversación libre) | `201 { sesion: { id, temaId }, saludo: { texto, frase } }` |

El saludo no usa IA, así que la sesión se abre aunque Groq no responda. `frase` es la primera frase modelo del tema (o `null` en conversación libre). Errores: `DATOS_INVALIDOS`, `TEMA_NO_ENCONTRADO`.

## Protocolo WebSocket

Conexión: `/tiempo-real?sesion=<id>&token=<jwt>`. El token debe ser de un estudiante y la sesión debe ser suya.

| Dirección | Mensaje | Significado |
|---|---|---|
| servidor → cliente | `{ "tipo": "conectado", "sesionId" }` | Conexión aceptada |
| cliente → servidor | `{ "tipo": "inicio_turno" }` | El estudiante empieza a hablar (descarta el audio de un turno anterior sin terminar) |
| cliente → servidor | *(binario)* | Trozos de audio: webm/opus, mp4/m4a, ogg, wav o mp3 (se detecta solo) |
| cliente → servidor | `{ "tipo": "fin_turno" }` | El estudiante terminó |
| servidor → cliente | `{ "tipo": "procesando" }` | Turno en proceso |
| servidor → cliente | `{ "tipo": "resultado_turno", transcripcion, evaluacion, respuesta, latenciaMs }` | Ver abajo |
| servidor → cliente | `{ "tipo": "error", "codigo" }` | Ver códigos abajo |

```json
{
  "tipo": "resultado_turno",
  "transcripcion": "hi let me intro deuce my self",
  "evaluacion": {
    "puntaje": 82,
    "nivel": "bien",
    "mensaje": "Bien hecho. Practica la palabra \"introduce\".",
    "palabras": [
      { "texto": "Hi,", "correcta": true },
      { "texto": "introduce", "correcta": false, "escuchado": "intro",
        "sugerencia": "Se escuchó \"intro\". En \"introduce\" cuida la vocal de \"cup\": una \"a\" corta y relajada." }
    ]
  },
  "respuesta": { "texto": "Nice! Now say this:", "frase": "I am friendly and funny.", "audioUrl": null },
  "latenciaMs": 2300
}
```

`audioUrl` siempre es `null` por ahora: el frontend usa la voz del dispositivo (el formato del audio del tutor está pendiente de acordar).

Códigos de error: `TOKEN_INVALIDO`, `SESION_REQUERIDA`, `SESION_NO_ENCONTRADA`, `PERMISO_DENEGADO`, `JSON_INVALIDO`, `TIPO_DESCONOCIDO`, `TURNO_NO_INICIADO`, `TURNO_EN_PROCESO`, `AUDIO_VACIO`, `AUDIO_DEMASIADO_GRANDE`, `FORMATO_AUDIO_NO_SOPORTADO`, `TRANSCRIPCION_VACIA`, `TUTOR_NO_DISPONIBLE` (falta `GROQ_API_KEY`), `IA_NO_DISPONIBLE`, `IA_TIEMPO_AGOTADO`, `IA_LIMITE_ALCANZADO`, `IA_RESPUESTA_INVALIDA`, `ERROR_PROCESAMIENTO`.

### Cómo se procesa un turno

1. **Transcripción:** el audio (solo en memoria, nunca se guarda) se envía a Whisper en Groq (`MODELO_TRANSCRIPCION`).
2. **Tutor:** un modelo de lenguaje en Groq (`MODELO_TUTOR`) recibe el tema del syllabus, los últimos turnos y la transcripción. Devuelve la respuesta de Thommy, la siguiente frase para practicar, la versión corregida y los errores de gramática y vocabulario (explicados en español).
3. **Análisis fonético** (`servicios/analisisFonetico.js`): la frase de referencia (la que Thommy pidió decir o, en conversación libre, la versión corregida) y la transcripción se convierten a fonemas con el diccionario CMU y se alinean con distancia de edición. Así se sabe qué palabra se desvió y en qué sonido, con consejos para los sonidos difíciles para hispanohablantes (th, v/b, vocales cortas y largas…).
4. **Evaluación:** el puntaje de pronunciación se clasifica en `excelente` (≥ 85), `bien` (≥ 65) o `practicar`. La fluidez sale del ritmo (palabras por minuto) y de las pausas largas.
5. **Registro:** los puntajes de pronunciación, vocabulario, gramática y fluidez se guardan en `resultados_turno` para los reportes.

> **Limitación:** el análisis compara lo que Whisper entendió con la referencia. Solo detecta desviaciones que hacen que se escuche otra palabra (o ninguna); un acento que Whisper igual entiende cuenta como correcto. Los umbrales están pendientes de validar con el profesor.

## Progreso del estudiante

`GET /api/estudiante/progreso?periodo=ultima_semana|ultimo_mes|semestre` (rol estudiante; por defecto `ultimo_mes`)

```json
{
  "periodo": "ultimo_mes", "promedioGeneral": 79, "variacion": 3, "totalTurnos": 12,
  "areas": [{ "clave": "pronunciacion", "nombre": "Pronunciación", "valor": 82 }],
  "evolucion": [{ "etiqueta": "Sem 1", "valor": 66 }, { "etiqueta": null, "valor": 70 }],
  "fortalezas": ["Buen desempeño en Pronunciación"],
  "areasMejorar": ["Gramática"]
}
```

- `variacion`: puntos frente al periodo anterior. En `semestre` compara los últimos 30 días con los primeros 30 del semestre (enero-junio o julio-diciembre).
- `evolucion`: 7 puntos repartidos en el periodo. Un tramo sin práctica repite el valor anterior, porque el gráfico del frontend necesita números en todos los puntos.
- Sin práctica en el periodo, los valores son `0` y `totalTurnos` es `0`.

## Perfil docente

Todas exigen rol `docente`. El docente solo ve a los estudiantes de su grupo (código de grupo o `npm run asignar-docente`). `periodo` funciona igual que en el progreso del estudiante.

| Método | Ruta | Respuesta |
|---|---|---|
| POST | `/api/docente/estudiantes/:id/contrasena-temporal` | `{ estudiante, contrasenaTemporal }` (ver "Contraseña olvidada") |
| GET | `/api/docente/estudiantes?busqueda=` | `{ estudiantes: [{ id, nombre, nivel, promedioGeneral, variacion }] }` (último mes; la búsqueda ignora tildes) |
| GET | `/api/docente/alertas` | `{ alertas: [{ id, nombre, nivel, promedioGeneral, motivo }] }`: promedio < 65 % o variación negativa (solo estudiantes con práctica) |
| GET | `/api/docente/estudiantes/:id/reporte?periodo=` | `{ estudiante, periodo, promedioGeneral, variacion, totalTurnos, areas }` |
| GET | `/api/docente/estudiantes/:id/detalle?periodo=` | `{ estudiante, periodo, evolucion, fortalezas, areasMejorar }` |
| GET | `/api/docente/estudiantes/:id/falencias` | `{ estudiante, falencias: [{ clave, area, tema, descripcion, porcentaje }] }`: por área, el tema más bajo del semestre, de menor a mayor |
| GET | `/api/docente/estudiantes/:id/recomendaciones` | `{ estudiante, recomendaciones: [{ id, texto, incluida, propia }] }`: la primera vez se crean sugerencias a partir de las falencias |
| POST | `/api/docente/estudiantes/:id/recomendaciones` | Cuerpo `{ texto }` (1-140) → `201 { recomendacion }` |
| PATCH | `/api/docente/estudiantes/:id/recomendaciones/:recId` | Cuerpo `{ incluida }` → `{ recomendacion }` |
| DELETE | `/api/docente/estudiantes/:id/recomendaciones/:recId` | `204` |

Errores: `DATOS_INVALIDOS` (400), `ESTUDIANTE_NO_ENCONTRADO` (404, también si no es del docente), `RECOMENDACION_NO_ENCONTRADA` (404).

> El criterio de alertas y los umbrales de fortalezas (≥ 75) y áreas a mejorar (< 65) son los del prototipo del frontend: pendientes de validación con el profesor. El envío a padres queda fuera hasta que se decida.

## Estructura

```
src/
├── app.js                  # Express y rutas REST
├── servidor.js             # HTTP + WebSocket en el mismo puerto
├── config/                 # entorno y conexión a la BD
├── bd/                     # migraciones, semillas y scripts de administración
├── rutas/ controladores/   # un archivo por recurso
├── validaciones/           # validación de entradas
├── repositorios/           # consultas SQL
├── servicios/              # autenticación, tutor, análisis fonético, evaluación y reportes
│   └── ia/clienteGroq.js   # Whisper y modelo de lenguaje en Groq
└── tiempo-real/            # WebSocket, contexto de la sesión y buffer de audio por turno
pruebas/                    # Jest + supertest (la IA y la BD se simulan)
```

## Despliegue en Render

1. New → Web Service → conectar el repositorio.
2. Root directory: `backend` · Build: `npm install` · Start: `npm start`.
3. Variables de entorno: `DATABASE_URL`, `ORIGENES_PERMITIDOS`, `JWT_SECRETO`, `GROQ_API_KEY` y `ENTORNO=produccion`.

El plan gratuito se duerme tras 15 minutos sin uso; abre `/api/salud` un minuto antes de una demo.
