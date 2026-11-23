// Voz de Thommy con Piper: cabecera WAV, proceso persistente, almacén de audios y GET /api/voz/:id
const { EventEmitter } = require('events')
const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const request = require('supertest')
const { crearSintetizadorPiper, cambiarTonoWav, limpiarTexto } = require('../src/servicios/voz/sintetizadorPiper')
const { crearServicioVoz } = require('../src/servicios/voz/servicioVoz')
const { crearRutasVoz } = require('../src/rutas/voz')

// WAV mínimo: cabecera de 44 bytes (PCM 16 bits mono) y algunas muestras
function crearWav (frecuencia = 22050, muestras = 8) {
  const wav = Buffer.alloc(44 + muestras * 2)
  wav.write('RIFF', 0, 'ascii')
  wav.writeUInt32LE(36 + muestras * 2, 4)
  wav.write('WAVE', 8, 'ascii')
  wav.write('fmt ', 12, 'ascii')
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(frecuencia, 24)
  wav.writeUInt32LE(frecuencia * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36, 'ascii')
  wav.writeUInt32LE(muestras * 2, 40)
  return wav
}

// Proceso falso de Piper: por cada línea JSON escribe un WAV en output_file y responde su ruta
function crearPiperFalso ({ responder = true } = {}) {
  const lanzados = []
  const lanzar = jest.fn((binario, argumentos) => {
    const proceso = new EventEmitter()
    proceso.stdout = new EventEmitter()
    proceso.stdout.setEncoding = () => {}
    proceso.stderr = new EventEmitter()
    proceso.kill = jest.fn(() => proceso.emit('exit', null))
    proceso.lineas = []
    proceso.stdin = {
      write (linea) {
        const { text: texto, output_file: archivo } = JSON.parse(linea)
        proceso.lineas.push(texto)
        if (!responder) return
        fs.writeFileSync(archivo, crearWav())
        setImmediate(() => proceso.stdout.emit('data', `${archivo}\r\n`))
      },
      end: jest.fn()
    }
    proceso.argumentos = argumentos
    lanzados.push(proceso)
    return proceso
  })
  return { lanzar, lanzados }
}

function crearArchivosFalsos () {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'piper-prueba-'))
  const binario = path.join(carpeta, 'piper')
  const modelo = path.join(carpeta, 'voz.onnx')
  fs.writeFileSync(binario, '')
  fs.writeFileSync(modelo, '')
  return { carpeta, binario, modelo }
}

describe('cambiarTonoWav', () => {
  test('multiplica la frecuencia de muestreo sin tocar las muestras', () => {
    const original = crearWav(22050)
    const aguda = cambiarTonoWav(original, 1.28)
    expect(aguda.readUInt32LE(24)).toBe(28224)
    expect(aguda.readUInt32LE(28)).toBe(28224 * 2)
    expect(aguda.subarray(36)).toEqual(original.subarray(36))
    expect(original.readUInt32LE(24)).toBe(22050)
  })

  test('rechaza lo que no es WAV', () => {
    expect(() => cambiarTonoWav(Buffer.from('no es un wav'), 1.2)).toThrow(/WAV/)
  })
})

describe('sintetizadorPiper', () => {
  test('limpia el texto en una sola línea', () => {
    expect(limpiarTexto('  Hi!\nHow   are\tyou? ')).toBe('Hi! How are you?')
    expect(limpiarTexto('a'.repeat(1000))).toHaveLength(600)
  })

  test('sin binario o modelo queda desactivado y no lanza procesos', async () => {
    const { lanzar } = crearPiperFalso()
    const sintetizador = crearSintetizadorPiper({ binario: '/no/existe/piper', modelo: '/no/existe.onnx', lanzar })
    expect(sintetizador.estaConfigurado).toBe(false)
    expect(sintetizador.estado()).toMatchObject({ estaConfigurada: false, motor: 'navegador' })
    await expect(sintetizador.sintetizar('Hi')).rejects.toThrow(/no está instalado/)
    expect(await sintetizador.precalentar()).toBe(false)
    expect(lanzar).not.toHaveBeenCalled()
  })

  test('mantiene un solo proceso, responde en orden y sube el tono', async () => {
    const { carpeta, binario, modelo } = crearArchivosFalsos()
    const { lanzar, lanzados } = crearPiperFalso()
    const sintetizador = crearSintetizadorPiper({ binario, modelo, tono: 1.25, velocidad: 1.0, carpetaTemporal: carpeta, lanzar })

    const [uno, dos] = await Promise.all([sintetizador.sintetizar('Hi!'), sintetizador.sintetizar('How are you?')])

    expect(lanzar).toHaveBeenCalledTimes(1)
    expect(lanzados[0].argumentos).toEqual(expect.arrayContaining(['--json-input', '--length_scale', '1.25', '--model', modelo]))
    expect(lanzados[0].lineas).toEqual(['Hi!', 'How are you?'])
    expect(uno.readUInt32LE(24)).toBe(Math.round(22050 * 1.25))
    expect(dos.readUInt32LE(24)).toBe(Math.round(22050 * 1.25))
    // Los WAV temporales se borran después de leerlos
    // El borrado es asíncrono: con muchas pruebas en paralelo puede tardar un poco más
    const quedanWav = () => fs.readdirSync(carpeta).filter((archivo) => archivo.endsWith('.wav'))
    for (let espera = 0; espera < 40 && quedanWav().length > 0; espera++) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    expect(quedanWav()).toEqual([])
    sintetizador.detener()
  })

  test('si Piper se cierra, falla lo pendiente y arranca de nuevo en la siguiente petición', async () => {
    const { carpeta, binario, modelo } = crearArchivosFalsos()
    const { lanzar, lanzados } = crearPiperFalso({ responder: false })
    const sintetizador = crearSintetizadorPiper({ binario, modelo, carpetaTemporal: carpeta, lanzar })

    const pendiente = sintetizador.sintetizar('Hi!')
    lanzados[0].emit('exit', 1)
    await expect(pendiente).rejects.toThrow(/Piper se cerró/)

    const otra = sintetizador.sintetizar('Again')
    expect(lanzar).toHaveBeenCalledTimes(2)
    lanzados[1].emit('exit', 1)
    await expect(otra).rejects.toThrow()
  })
})

describe('servicioVoz y GET /api/voz/:id', () => {
  function crearApp (voz) {
    const app = express()
    app.use('/api/voz', crearRutasVoz(voz))
    return app
  }

  test('prepara el audio, devuelve su URL y lo entrega como WAV', async () => {
    const wav = crearWav()
    const sintetizador = { estaConfigurado: true, sintetizar: jest.fn(async () => wav), estado: () => ({}) }
    const voz = crearServicioVoz({ sintetizador })

    const url = voz.prepararAudio('Hi! How are you?')
    expect(url).toMatch(/^\/api\/voz\/[0-9a-f-]{36}$/)
    expect(sintetizador.sintetizar).toHaveBeenCalledWith('Hi! How are you?')

    const respuesta = await request(crearApp(voz)).get(url)
    expect(respuesta.status).toBe(200)
    expect(respuesta.headers['content-type']).toMatch(/audio\/wav/)
    expect(Buffer.from(respuesta.body)).toEqual(wav)
  })

  test('sin Piper no hay audioUrl (la app usa la voz del dispositivo)', () => {
    const voz = crearServicioVoz({ sintetizador: { estaConfigurado: false } })
    expect(voz.prepararAudio('Hi')).toBeNull()
    expect(voz.estaDisponible).toBe(false)
  })

  test('responde 404 a ids desconocidos o vencidos y 503 si la síntesis falló', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    let momento = 0
    const sintetizador = {
      estaConfigurado: true,
      sintetizar: jest.fn()
        .mockResolvedValueOnce(crearWav())
        .mockRejectedValueOnce(new Error('falló'))
    }
    const voz = crearServicioVoz({ sintetizador, ahora: () => momento })
    const app = crearApp(voz)

    const vencida = voz.prepararAudio('Hi')
    const fallida = voz.prepararAudio('Hello')
    expect((await request(app).get(fallida)).status).toBe(503)
    expect((await request(app).get('/api/voz/no-es-un-id')).status).toBe(404)
    expect((await request(app).get('/api/voz/00000000-0000-0000-0000-000000000000')).status).toBe(404)
    momento = 11 * 60 * 1000
    expect((await request(app).get(vencida)).status).toBe(404)
    jest.restoreAllMocks()
  })
})
