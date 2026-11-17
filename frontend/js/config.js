// Configuración del frontend.

// URL fija del backend. Solo se usa en la app móvil: scripts/preparar-web.js la escribe al empaquetar
// (URL_API=https://... npm run android). Vacía = se calcula sola (ver resolverUrlApi).
const URL_API_FIJA = ''
const URL_API_LOCAL = 'http://localhost:3000'

// - Servida por el backend (Render o localhost:3000): la API está en la misma dirección.
// - Servidor de desarrollo (npm run dev, puerto 8081), app móvil sin URL fija o pruebas en Node: backend local.
export function resolverUrlApi (ubicacion = globalThis.location, urlFija = URL_API_FIJA) {
  if (urlFija) return urlFija
  const esWeb = typeof ubicacion?.protocol === 'string' && ubicacion.protocol.startsWith('http')
  const esServidorDesarrollo = ubicacion?.port === '8081'
  const esAppMovil = ubicacion?.hostname === 'localhost' && !ubicacion?.port
  if (!esWeb || esServidorDesarrollo || esAppMovil) return URL_API_LOCAL
  return ubicacion.origin
}

export const configuracion = Object.freeze({
  urlApi: resolverUrlApi(),

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
