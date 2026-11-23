const { crearProcesadorTurno } = require('../src/servicios/procesadorTurno')

function crearDependencias ({ texto = 'nice to meet you', guardarFalla = false } = {}) {
  const guardados = []
  return {
    guardados,
    ia: {
      transcribirAudio: jest.fn(async () => ({ texto, duracion: 2, segmentos: [] }))
    },
    tutor: {
      responderTurno: jest.fn(async () => ({
        respuesta: 'Nice to meet you too!',
        frase: null,
        correccion: 'Nice to meet you.',
        puntajeGramatica: 90,
        puntajeVocabulario: 80,
        errores: []
      }))
    },
    repositorio: {
      listarUltimosTurnos: jest.fn(async () => []),
      guardarResultadoTurno: jest.fn(async (resultado) => {
        if (guardarFalla) throw new Error('sin bd')
        guardados.push(resultado)
      })
    },
    voz: { prepararAudio: jest.fn((texto) => texto ? '/api/voz/abc' : null) }
  }
}

describe('procesadorTurno', () => {
  test('arma el resultado_turno con el audio de Thommy, lo guarda y pasa el saludo al tutor', async () => {
    const dependencias = crearDependencias()
    const procesarTurno = crearProcesadorTurno(dependencias)
    const contexto = { sesion: { id: 7 }, tema: null, nivel: 1, saludo: 'Hi! How are you?' }

    const resultado = await procesarTurno(Buffer.alloc(10), contexto)

    expect(resultado).toMatchObject({
      tipo: 'resultado_turno',
      transcripcion: 'nice to meet you',
      evaluacion: { puntaje: 100, nivel: 'excelente' },
      respuesta: { texto: 'Nice to meet you too!', frase: null, audioUrl: '/api/voz/abc' }
    })
    expect(dependencias.guardados[0]).toMatchObject({
      sesionId: 7,
      referencia: 'Nice to meet you.',
      puntajes: { pronunciacion: 100, gramatica: 90, vocabulario: 80, fluidez: expect.any(Number) }
    })
    expect(dependencias.voz.prepararAudio).toHaveBeenCalledWith('Nice to meet you too!')
    expect(dependencias.tutor.responderTurno.mock.calls[0][0]).toMatchObject({ saludo: 'Hi! How are you?', transcripcion: 'nice to meet you' })
  })

  test('compara la pronunciación contra la versión corregida de lo que dijo', async () => {
    const dependencias = crearDependencias({ texto: 'nice to meat you' })
    const procesarTurno = crearProcesadorTurno(dependencias)
    await procesarTurno(Buffer.alloc(10), { sesion: { id: 1 } })
    expect(dependencias.guardados[0].referencia).toBe('Nice to meet you.')
  })

  test('falla con TRANSCRIPCION_VACIA si no se entendió nada', async () => {
    const procesarTurno = crearProcesadorTurno(crearDependencias({ texto: '' }))
    await expect(procesarTurno(Buffer.alloc(10), { sesion: { id: 1 } })).rejects.toMatchObject({ codigo: 'TRANSCRIPCION_VACIA' })
  })

  test('entrega el resultado aunque no se pueda guardar', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const procesarTurno = crearProcesadorTurno(crearDependencias({ guardarFalla: true }))
    const resultado = await procesarTurno(Buffer.alloc(10), { sesion: { id: 1 } })
    expect(resultado.tipo).toBe('resultado_turno')
    jest.restoreAllMocks()
  })
})
