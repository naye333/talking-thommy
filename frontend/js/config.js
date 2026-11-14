// Configuración del frontend. Ajusta urlApi al desplegar (por ejemplo, con la URL de Render).
export const configuracion = Object.freeze({
  urlApi: 'http://localhost:3000',

  // El backend todavía no tiene estos endpoints. Mientras sean true, esas pantallas usan datos de ejemplo.
  // Son independientes porque los endpoints pueden llegar en momentos distintos.
  // Perfil docente (estudiantes, reportes, falencias, recomendaciones): docs/propuesta-api-perfil-docente.md
  usarDatosEjemploDocente: true,
  // Progreso del estudiante (GET /api/estudiante/progreso): docs/contrato-api-perfil-estudiante.md
  usarDatosEjemploProgreso: true,

  // Conversación con Thommy:
  //   'ejemplo'    → tutor simulado en el frontend (el backend aún no transcribe ni evalúa)
  //   'tiempoReal' → POST /api/sesiones + WebSocket /tiempo-real (ver docs/contrato-api-perfil-estudiante.md)
  modoConversacion: 'ejemplo',

  // Modo 'tiempoReal': cuánto esperar la respuesta del servidor (conexión y resultado de cada turno)
  // antes de mostrar SIN_CONEXION. Ajustar según la latencia que mida el equipo de IA.
  tiempoMaximoRespuestaMs: 30000
})
