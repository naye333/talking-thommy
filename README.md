# Talking Thommy

Tutor conversacional con IA para la práctica oral de inglés de los estudiantes de Inglés I y II (Universidad Santo Tomás, Villavicencio).

El estudiante conversa con Thommy siguiendo los temas del syllabus. La app transcribe su voz, analiza su pronunciación y le da retroalimentación. El docente consulta el progreso, las falencias y deja recomendaciones.

## Estructura

| Carpeta | Contenido |
|---|---|
| [`backend/`](backend/README.md) | API REST y WebSocket (Node.js, Express, PostgreSQL en Neon, IA en Groq) |
| [`frontend/`](frontend/README.md) | App móvil (HTML, CSS y JavaScript empaquetados con Capacitor) |
| `docs/` | Acta de constitución, estándares del equipo y contratos de la API |
| `src/` | Primer prototipo estático del login (KAN-4). La app vigente está en `frontend/` |

## Puesta en marcha local

Backend (terminal 1):

```bash
cd backend
npm install
cp .env.example .env      # DATABASE_URL de Neon, JWT_SECRETO y GROQ_API_KEY
npm run migrar
npm run sembrar-syllabus
npm run dev               # http://localhost:3000/api/salud
```

Frontend (terminal 2):

```bash
cd frontend
npm install
npm run dev               # http://localhost:8081
```

El frontend usa el backend real por defecto (`frontend/js/config.js`). Para probar la interfaz sin backend, cambia `modoConversacion` a `'ejemplo'` y los dos `usarDatosEjemplo…` a `true`.

## Administración

```bash
cd backend
npm run crear-docente -- correo@usta.edu.co "Nombre" "contrasena"     # muestra el código de grupo
npm run restablecer-contrasena -- correo@usta.edu.co "NuevaContrasena"
npm run medir-calidad -- carpeta-con-audios                            # docs/metricas-calidad.md
```

Los estudiantes se unen al grupo del docente con su código (al registrarse o en su perfil). Más detalles en `docs/manual-de-usuario.md` y `docs/historias-de-usuario.md`.

## Pruebas

```bash
cd backend && npm run lint && npm test
cd frontend && npm test
```

Ambas se ejecutan en GitHub Actions en cada pull request hacia `develop` y `main`.
