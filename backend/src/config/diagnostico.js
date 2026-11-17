// Revisa la configuración y explica en español qué falta y cómo arreglarlo.
// Lo usan el arranque del servidor (avisos) y npm run verificar (revisión completa).
const fs = require('fs')
const entorno = require('./entorno')

// Traduce los errores de conexión más comunes de PostgreSQL/Neon a una causa probable
function explicarErrorBaseDatos (mensaje = '') {
  if (/password authentication failed/i.test(mensaje)) {
    return 'La contraseña de DATABASE_URL no es correcta. Copia de nuevo la cadena desde Neon → Connect (si cambiaron la contraseña, la anterior ya no sirve).'
  }
  if (/ENOTFOUND|getaddrinfo/i.test(mensaje)) {
    return 'No se encuentra el servidor de Neon. Revisa que DATABASE_URL esté completa y que haya conexión a internet.'
  }
  if (/ETIMEDOUT|timeout|ECONNREFUSED/i.test(mensaje)) {
    return 'Neon no responde. Revisa la conexión a internet o si la red (por ejemplo, la de la universidad) bloquea el puerto 5432; prueba con los datos del celular.'
  }
  if (/does not exist/i.test(mensaje)) {
    return 'La base de datos o una tabla no existe. Revisa el nombre al final de DATABASE_URL y ejecuta npm run migrar.'
  }
  if (/Invalid URL|invalid connection|TypeError/i.test(mensaje)) {
    return 'DATABASE_URL no tiene el formato correcto. Debe empezar por postgresql:// y estar en una sola línea, sin comillas ni espacios.'
  }
  return mensaje
}

// Problemas de configuración que se pueden detectar sin conectarse a nada
function revisarConfiguracion (configuracion = entorno, existeArchivo = fs.existsSync) {
  const problemas = []
  // Sin .env solo es un problema si las variables tampoco llegan por otro lado (en Render vienen del panel)
  if (!configuracion.urlBaseDatos && !existeArchivo(configuracion.rutaEnv)) {
    problemas.push({
      gravedad: 'error',
      mensaje: `No existe el archivo ${configuracion.rutaEnv}.`,
      solucion: 'En la carpeta backend ejecuta: copy .env.example .env (Windows) o cp .env.example .env, y llena los valores.'
    })
  }
  if (!configuracion.urlBaseDatos) {
    problemas.push({
      gravedad: 'error',
      mensaje: 'Falta DATABASE_URL: el registro, el ingreso y todo lo demás responderán "El servicio no está disponible".',
      solucion: 'Pega en .env la cadena de Neon (Neon → Connect, con Connection pooling): DATABASE_URL=postgresql://...'
    })
  } else if (!/^postgres(ql)?:\/\//.test(configuracion.urlBaseDatos)) {
    problemas.push({
      gravedad: 'error',
      mensaje: 'DATABASE_URL no empieza por postgresql://.',
      solucion: 'Copia la cadena completa desde Neon → Connect, en una sola línea y sin comillas.'
    })
  }
  if (!configuracion.groqApiKey) {
    problemas.push({
      gravedad: 'aviso',
      mensaje: 'Falta GROQ_API_KEY: Thommy no podrá escuchar ni responder (TUTOR_NO_DISPONIBLE).',
      solucion: 'Crea una clave gratis en https://console.groq.com/keys y pégala en .env: GROQ_API_KEY=gsk_...'
    })
  }
  if (!configuracion.esProduccion && configuracion.jwtSecreto === 'secreto-solo-para-desarrollo') {
    problemas.push({
      gravedad: 'aviso',
      mensaje: 'JWT_SECRETO usa el valor de desarrollo.',
      solucion: 'Para uso real, escribe en .env un JWT_SECRETO largo y secreto.'
    })
  }
  return problemas
}

function formatearProblema ({ gravedad, mensaje, solucion }) {
  return `${gravedad === 'error' ? '✘' : '!'} ${mensaje}\n    → ${solucion}`
}

module.exports = { explicarErrorBaseDatos, revisarConfiguracion, formatearProblema }
