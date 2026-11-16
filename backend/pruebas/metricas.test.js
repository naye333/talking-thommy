const fs = require('fs')
const os = require('os')
const path = require('path')

jest.mock('../src/servicios/ia/clienteGroq', () => ({
  transcribirAudio: jest.fn(async (audio) => {
    if (audio.toString() === 'falla') throw Object.assign(new Error('x'), { codigo: 'IA_NO_DISPONIBLE' })
    return { texto: audio.toString(), duracion: 1, segmentos: [] }
  }),
  completarJson: jest.fn(async () => ({ respuesta: 'Ok', frase: null, correccion: 'x', errores: [] }))
}))

const { calcularWer, percentil, promedio } = require('../src/servicios/metricas')
const { medirCalidad } = require('../src/herramientas/medirCalidad')

describe('metricas', () => {
  test('WER cuenta sustituciones, omisiones e inserciones', () => {
    expect(calcularWer('Nice to meet you.', 'nice to meet you')).toBe(0)
    expect(calcularWer('Nice to meet you.', 'nice to meat you')).toBe(0.25)
    expect(calcularWer('Nice to meet you.', 'nice meet you you')).toBe(0.5)
    expect(calcularWer('', '')).toBe(0)
    expect(calcularWer('', 'hola')).toBe(1)
  })

  test('percentiles y promedio', () => {
    expect(percentil([100, 300, 200, 400], 50)).toBe(200)
    expect(percentil([100, 300, 200, 400], 95)).toBe(400)
    expect(percentil([], 50)).toBeNull()
    expect(promedio([1, 2, 3])).toBe(2)
    expect(promedio([])).toBeNull()
  })
})

describe('medirCalidad', () => {
  let carpeta

  beforeEach(() => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'calidad-'))
    fs.writeFileSync(path.join(carpeta, 'a.webm'), 'nice to meet you')
    fs.writeFileSync(path.join(carpeta, 'b.webm'), 'falla')
    fs.writeFileSync(path.join(carpeta, 'casos.json'), JSON.stringify([
      { audio: 'a.webm', texto: 'Nice to meet you.' },
      { audio: 'b.webm', texto: 'Hello.' }
    ]))
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    fs.rmSync(carpeta, { recursive: true, force: true })
    jest.restoreAllMocks()
  })

  test('mide cada caso, resume y guarda el reporte', async () => {
    const { resumen, resultados } = await medirCalidad([carpeta, '--con-tutor'])
    expect(resumen).toMatchObject({ casos: 2, fallidos: 1, werPromedio: 0, casosSinErrores: 1, puntajePronunciacionPromedio: 100 })
    expect(resultados[1].error).toBe('IA_NO_DISPONIBLE')
    expect(resultados[0].latenciaTutorMs).toEqual(expect.any(Number))
    expect(fs.readdirSync(carpeta).some((archivo) => archivo.startsWith('reporte-calidad-'))).toBe(true)
  })

  test('valida los argumentos y casos.json', async () => {
    await expect(medirCalidad([])).rejects.toThrow(/Uso/)
    fs.unlinkSync(path.join(carpeta, 'casos.json'))
    await expect(medirCalidad([carpeta])).rejects.toThrow(/No existe/)
    fs.writeFileSync(path.join(carpeta, 'casos.json'), '[]')
    await expect(medirCalidad([carpeta])).rejects.toThrow(/al menos un caso/)
  })
})
