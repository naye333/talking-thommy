const request = require('supertest')
const { crearApp } = require('../src/app')

describe('GET /api/salud', () => {
  const app = crearApp()

  test('responde estado ok y el estado de la base de datos', async () => {
    const respuesta = await request(app).get('/api/salud')

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.estado).toBe('ok')
    expect(respuesta.body.baseDatos).toHaveProperty('estaConectada')
  })

  test('sin DATABASE_URL reporta la base de datos como no conectada', async () => {
    const respuesta = await request(app).get('/api/salud')

    expect(respuesta.body.baseDatos.estaConectada).toBe(false)
  })

  test('devuelve 404 en rutas inexistentes', async () => {
    const respuesta = await request(app).get('/api/no-existe')

    expect(respuesta.status).toBe(404)
    expect(respuesta.body.error).toBe('RUTA_NO_ENCONTRADA')
  })
})
