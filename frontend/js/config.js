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
  //   'tiempoReal' → IA real: POST /api/sesiones + WebSocket /tiempo-real (ver docs/contrato-api-perfil-estudiante.md).
  //                  Requiere el backend y el servicio de IA (ia/) encendidos.
  //   'ejemplo'    → tutor simulado en el frontend, sin backend (útil para trabajar solo en la interfaz)
  modoConversacion: 'tiempoReal',

  // Modo 'tiempoReal': cuánto esperar la respuesta del servidor (conexión y resultado de cada turno)
  // antes de mostrar SIN_CONEXION. Medido por IA en un PC de 8 GB sin GPU: 5-20 s por turno.
  tiempoMaximoRespuestaMs: 90000
})
