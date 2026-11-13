const request = require('supertest')

// Base de datos simulada con un tema por unidad
jest.mock('../src/repositorios/repositorioSyllabus', () => ({
  listarUnidadesPorNivel: async (nivel) => nivel === 1
    ? [{ id: 1, numero: 1, titulo: 'First Term', descripcion: null, temas: [{ id: 10, numero: 1, semana: 1, titulo: 'The alphabet' }] }]
    : [],
  buscarTemaPorId: async (id) => id === 10
    ? { id: 10, nivel: 1, titulo: 'The alphabet', vocabulario: ['letter'], frasesModelo: ['How do you spell it?'] }
    : null
}))

const { crearApp } = require('../src/app')
const { generarToken } = require('../src/servicios/servicioAutenticacion')
const { validarSyllabus } = require('../src/validaciones/validacionesSyllabus')
const syllabusIngles1 = require('../src/bd/semillas/syllabus-ingles-1.json')

const app = crearApp()
const tokenEstudiante = generarToken({ id: 1, rol: 'estudiante', nivel: 1 })
const tokenDocente = generarToken({ id: 2, rol: 'docente', nivel: null })
const conToken = (peticion, token) => peticion.set('Authorization', `Bearer ${token}`)

describe('GET /api/syllabus', () => {
  test('exige token', async () => {
    const respuesta = await request(app).get('/api/syllabus')
    expect(respuesta.status).toBe(401)
  })

  test('sin ?nivel usa el nivel del estudiante', async () => {
    const respuesta = await conToken(request(app).get('/api/syllabus'), tokenEstudiante)
    expect(respuesta.status).toBe(200)
    expect(respuesta.body.nivel).toBe(1)
    expect(respuesta.body.unidades[0].temas[0].titulo).toBe('The alphabet')
  })

  test('el docente consulta cualquier nivel con ?nivel', async () => {
    const respuesta = await conToken(request(app).get('/api/syllabus?nivel=2'), tokenDocente)
    expect(respuesta.status).toBe(200)
    expect(respuesta.body).toEqual({ nivel: 2, unidades: [] })
  })

  test('el docente sin ?nivel recibe 400', async () => {
    const respuesta = await conToken(request(app).get('/api/syllabus'), tokenDocente)
    expect(respuesta.status).toBe(400)
    expect(respuesta.body.detalles[0].campo).toBe('nivel')
  })

  test('rechaza niveles distintos de 1 y 2', async () => {
    const respuesta = await conToken(request(app).get('/api/syllabus?nivel=3'), tokenEstudiante)
    expect(respuesta.status).toBe(400)
  })
})

describe('GET /api/syllabus/temas/:id', () => {
  test('devuelve el tema completo', async () => {
    const respuesta = await conToken(request(app).get('/api/syllabus/temas/10'), tokenEstudiante)
    expect(respuesta.status).toBe(200)
    expect(respuesta.body.tema.frasesModelo).toEqual(['How do you spell it?'])
  })

  test('404 si el tema no existe', async () => {
    const respuesta = await conToken(request(app).get('/api/syllabus/temas/999'), tokenEstudiante)
    expect(respuesta.status).toBe(404)
    expect(respuesta.body.error).toBe('TEMA_NO_ENCONTRADO')
  })

  test('400 si el id no es un número válido', async () => {
    const respuesta = await conToken(request(app).get('/api/syllabus/temas/abc'), tokenEstudiante)
    expect(respuesta.status).toBe(400)
  })
})

describe('validarSyllabus', () => {
  test('el syllabus oficial de Inglés I es válido', () => {
    expect(validarSyllabus(syllabusIngles1)).toEqual([])
  })

  test('el syllabus de Inglés I cubre las 10 semanas de clase de la planeación', () => {
    const semanas = syllabusIngles1.unidades.flatMap((unidad) => unidad.temas.map((tema) => tema.semana))
    expect(semanas).toEqual([1, 2, 3, 4, 7, 8, 9, 10, 13, 14])
  })

  test('rechaza un archivo sin unidades', () => {
    expect(validarSyllabus({})).toHaveLength(1)
    expect(validarSyllabus(null)).toHaveLength(1)
  })

  test('reporta cada campo inválido con su ubicación', () => {
    const errores = validarSyllabus({
      unidades: [
        { nivel: 3, numero: 0, titulo: '', temas: [{ numero: 1, semana: 30, titulo: '', objetivo: '', gramatica: [], vocabulario: 'x', frasesModelo: [''] }] },
        { nivel: 1, numero: 1, titulo: 'A', temas: [] },
        'no soy un objeto'
      ]
    })
    const texto = errores.join('\n')
    expect(texto).toMatch('unidades[0].nivel')
    expect(texto).toMatch('unidades[0].numero')
    expect(texto).toMatch('unidades[0].temas[0].semana')
    expect(texto).toMatch('unidades[0].temas[0].vocabulario')
    expect(texto).toMatch('unidades[1].temas debe tener al menos un tema')
    expect(texto).toMatch('unidades[2] no es un objeto')
  })

  test('detecta unidades y temas repetidos', () => {
    const tema = { numero: 1, titulo: 'T', objetivo: 'O', gramatica: ['g'], vocabulario: ['v'], frasesModelo: ['f'] }
    const unidad = { nivel: 1, numero: 1, titulo: 'U', temas: [tema, tema] }
    const texto = validarSyllabus({ unidades: [unidad, unidad] }).join('\n')
    expect(texto).toMatch('está repetido en la unidad')
    expect(texto).toMatch('la unidad 1 del nivel 1 está repetida')
  })

  test('detecta temas que no son objetos', () => {
    const errores = validarSyllabus({ unidades: [{ nivel: 1, numero: 1, titulo: 'U', temas: [null] }] })
    expect(errores).toContain('unidades[0].temas[0] no es un objeto')
  })
})
