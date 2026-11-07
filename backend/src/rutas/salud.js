const { Router } = require('express')
const { verificarConexion } = require('../config/baseDatos')

const rutasSalud = Router()

// GET /api/salud → estado del servicio y de la base de datos
rutasSalud.get('/', async (_request, response) => {
  const baseDatos = await verificarConexion()
  response.json({
    estado: 'ok',
    servicio: 'talking-thommy-backend',
    marcaTiempo: new Date().toISOString(),
    baseDatos
  })
})

module.exports = rutasSalud
