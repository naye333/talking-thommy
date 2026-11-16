// Configuración del frontend. Ajusta urlApi al desplegar (por ejemplo, con la URL de Render).
export const configuracion = Object.freeze({
  urlApi: 'http://localhost:3000',

  // true = datos de ejemplo sin backend (para probar la interfaz); false = API real del backend.
  // Perfil docente (estudiantes, reportes, falencias, recomendaciones): docs/propuesta-api-perfil-docente.md
  usarDatosEjemploDocente: false,
  // Progreso del estudiante (GET /api/estudiante/progreso): docs/contrato-api-perfil-estudiante.md
  usarDatosEjemploProgreso: false,

  // Conversación con Thommy:
  //   'ejemplo'    → tutor simulado en el frontend, sin backend
  //   'tiempoReal' → POST /api/sesiones + WebSocket /tiempo-real (ver docs/contrato-api-perfil-estudiante.md)
  modoConversacion: 'tiempoReal',

  // Modo 'tiempoReal': cuánto esperar la respuesta del servidor (conexión y resultado de cada turno)
  // antes de mostrar SIN_CONEXION. Ajustar según la latencia que mida el equipo de IA.
  tiempoMaximoRespuestaMs: 30000
})
