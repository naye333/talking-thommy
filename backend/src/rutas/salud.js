const { Router } = require('express')
const { verificarConexion } = require('../config/baseDatos')
const entorno = require('../config/entorno')
const { explicarErrorBaseDatos } = require('../config/diagnostico')
const { estadoIaReciente } = require('../servicios/ia/estadoIa')

const rutasSalud = Router()

// GET /api/salud → estado del servicio y de la base de datos
rutasSalud.get('/', async (_request, response) => {
  const baseDatos = await verificarConexion()
  // Se explica la causa probable, pero nunca se devuelve la cadena de conexión
  if (!baseDatos.estaConectada) baseDatos.motivo = explicarErrorBaseDatos(baseDatos.motivo)
  response.json({
    estado: 'ok',
    servicio: 'talking-thommy-backend',
    marcaTiempo: new Date().toISOString(),
    baseDatos,
    ia: { estaConfigurada: Boolean(entorno.groqApiKey), ...estadoIaReciente() }
  })
})

module.exports = rutasSalud
