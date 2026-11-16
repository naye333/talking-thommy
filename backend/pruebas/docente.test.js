const request = require('supertest')

jest.mock('../src/repositorios/repositorioUsuarios', () => {
  const estudiantes = [
    { id: 1, nombre: 'Valentina Torres', nivel: 1 },
    { id: 2, nombre: 'Juan Pérez', nivel: 1 },
    { id: 3, nombre: 'Sin Práctica', nivel: 2 }
  ]
  return {
    listarEstudiantesDeDocente: jest.fn(async (docenteId, busqueda) => docenteId === 10
      ? estudiantes.filter((estudiante) => estudiante.nombre.toLowerCase().includes(busqueda.toLowerCase()))
      : []),
    buscarEstudianteDeDocente: async (docenteId, id) => (docenteId === 10 && estudiantes.find((e) => e.id === id)) || null
  }
})

jest.mock('../src/repositorios/repositorioPractica', () => {
  const hace = (dias) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
  const turno = (estudianteId, dias, puntaje, extra = {}) => ({
    estudianteId,
    temaTitulo: 'Introducing yourself',
    creadoEn: hace(dias),
    puntajes: { pronunciacion: puntaje, vocabulario: puntaje, gramatica: puntaje - 20, fluidez: puntaje },
    palabras: [],
    errores: [],
    ...extra
  })
  const resultados = [
    turno(1, 2, 85),
    turno(2, 40, 70),
    turno(2, 3, 55, { errores: [{ tipo: 'gramatica', explicacion: 'Usa "is" con "she".' }] })
  ]
  return {
    listarResultados: jest.fn(async (ids) => resultados.filter((resultado) => ids.includes(resultado.estudianteId)))
  }
})

jest.mock('../src/repositorios/repositorioRecomendaciones', () => {
  let recomendaciones = []
  let siguienteId = 1
  return {
    reiniciar: () => { recomendaciones = []; siguienteId = 1 },
    listar: async (estudianteId) => recomendaciones.filter((r) => r.estudianteId === estudianteId)
      .map(({ id, texto, incluida, propia }) => ({ id, texto, incluida, propia })),
    crear: async ({ estudianteId, texto, propia }) => {
      const recomendacion = { id: siguienteId++, estudianteId, texto, incluida: true, propia }
      recomendaciones.push(recomendacion)
      return { id: recomendacion.id, texto, incluida: true, propia }
    },
    actualizarIncluida: async ({ id, estudianteId, incluida }) => {
      const recomendacion = recomendaciones.find((r) => r.id === id && r.estudianteId === estudianteId)
      if (!recomendacion) return null
      recomendacion.incluida = incluida
      return { id, texto: recomendacion.texto, incluida, propia: recomendacion.propia }
    },
    eliminar: async ({ id, estudianteId }) => {
      const antes = recomendaciones.length
      recomendaciones = recomendaciones.filter((r) => !(r.id === id && r.estudianteId === estudianteId))
      return recomendaciones.length < antes
    }
  }
})

const repositorioRecomendaciones = require('../src/repositorios/repositorioRecomendaciones')
const { crearApp } = require('../src/app')
const { generarToken } = require('../src/servicios/servicioAutenticacion')

const app = crearApp()
const tokenDocente = generarToken({ id: 10, rol: 'docente', nivel: null })
const tokenEstudiante = generarToken({ id: 1, rol: 'estudiante', nivel: 1 })
const get = (ruta, token = tokenDocente) => request(app).get(ruta).set('Authorization', `Bearer ${token}`)
const conToken = (peticion) => peticion.set('Authorization', `Bearer ${tokenDocente}`)

beforeEach(() => repositorioRecomendaciones.reiniciar())

describe('perfil docente', () => {
  test('exige rol docente', async () => {
    expect((await get('/api/docente/estudiantes', tokenEstudiante)).status).toBe(403)
  })

  test('lista estudiantes con promedio y variación, y busca por nombre', async () => {
    const respuesta = await get('/api/docente/estudiantes')
    expect(respuesta.status).toBe(200)
    expect(respuesta.body.estudiantes).toEqual([
      { id: 1, nombre: 'Valentina Torres', nivel: 1, promedioGeneral: 80, variacion: 0 },
      { id: 2, nombre: 'Juan Pérez', nivel: 1, promedioGeneral: 50, variacion: -15 },
      { id: 3, nombre: 'Sin Práctica', nivel: 2, promedioGeneral: 0, variacion: 0 }
    ])
    const busqueda = await get('/api/docente/estudiantes?busqueda=juan')
    expect(busqueda.body.estudiantes.map((estudiante) => estudiante.id)).toEqual([2])
  })

  test('alertas solo de estudiantes con práctica y bajo desempeño', async () => {
    const respuesta = await get('/api/docente/alertas')
    expect(respuesta.body.alertas).toEqual([
      { id: 2, nombre: 'Juan Pérez', nivel: 1, promedioGeneral: 50, motivo: 'Promedio de 50%' }
    ])
  })

  test('reporte, detalle y falencias', async () => {
    const reporte = await get('/api/docente/estudiantes/2/reporte?periodo=ultimo_mes')
    expect(reporte.body).toMatchObject({ estudiante: { id: 2, nombre: 'Juan Pérez' }, promedioGeneral: 50, variacion: -15 })
    expect(reporte.body.areas.find((area) => area.clave === 'gramatica').valor).toBe(35)

    const detalle = await get('/api/docente/estudiantes/2/detalle')
    expect(detalle.body.evolucion).toHaveLength(7)
    expect(detalle.body.areasMejorar).toContain('Gramática')

    const falencias = await get('/api/docente/estudiantes/2/falencias')
    expect(falencias.body.falencias[0]).toMatchObject({ clave: 'gramatica', area: 'Gramática', tema: 'Introducing yourself' })
  })

  test('404 si el estudiante no es del docente; 400 si el id es inválido', async () => {
    const ajeno = await get('/api/docente/estudiantes/99/reporte')
    expect(ajeno.status).toBe(404)
    expect(ajeno.body.error).toBe('ESTUDIANTE_NO_ENCONTRADO')
    expect((await get('/api/docente/estudiantes/abc/reporte')).status).toBe(400)
  })

  test('recomendaciones: sugeridas, crear, incluir/excluir y eliminar', async () => {
    const iniciales = await get('/api/docente/estudiantes/2/recomendaciones')
    expect(iniciales.status).toBe(200)
    expect(iniciales.body.recomendaciones.length).toBeGreaterThan(0)
    expect(iniciales.body.recomendaciones.every((r) => r.propia === false)).toBe(true)

    const creada = await conToken(request(app).post('/api/docente/estudiantes/2/recomendaciones').send({ texto: 'Leer en voz alta' }))
    expect(creada.status).toBe(201)
    expect(creada.body.recomendacion).toMatchObject({ texto: 'Leer en voz alta', incluida: true, propia: true })
    const id = creada.body.recomendacion.id

    const larga = await conToken(request(app).post('/api/docente/estudiantes/2/recomendaciones').send({ texto: 'x'.repeat(141) }))
    expect(larga.status).toBe(400)

    const excluida = await conToken(request(app).patch(`/api/docente/estudiantes/2/recomendaciones/${id}`).send({ incluida: false }))
    expect(excluida.body.recomendacion.incluida).toBe(false)
    const sinBooleano = await conToken(request(app).patch(`/api/docente/estudiantes/2/recomendaciones/${id}`).send({ incluida: 'no' }))
    expect(sinBooleano.status).toBe(400)
    const noExiste = await conToken(request(app).patch('/api/docente/estudiantes/2/recomendaciones/999').send({ incluida: true }))
    expect(noExiste.body.error).toBe('RECOMENDACION_NO_ENCONTRADA')

    expect((await conToken(request(app).delete(`/api/docente/estudiantes/2/recomendaciones/${id}`))).status).toBe(204)
    expect((await conToken(request(app).delete(`/api/docente/estudiantes/2/recomendaciones/${id}`))).status).toBe(404)
  })

  test('sin práctica no hay recomendaciones sugeridas', async () => {
    const respuesta = await get('/api/docente/estudiantes/3/recomendaciones')
    expect(respuesta.body.recomendaciones).toEqual([])
  })
})
