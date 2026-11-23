// Voz de niño de Thommy con Piper (texto a voz libre que corre en el propio servidor, sin GPU).
// Piper queda abierto en segundo plano con la voz cargada: cada texto es una línea JSON por stdin y
// Piper responde con la ruta del WAV generado por stdout, en el mismo orden en que se pidieron.
//
// Voz de niño: Piper habla `tono` veces más despacio y luego el WAV se marca con una frecuencia de
// muestreo `tono` veces mayor. Al reproducirlo suena más agudo (como un niño) a la velocidad normal.
const { spawn } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

const MAX_CARACTERES = 600
const TIEMPO_MAXIMO_MS = 45000

// Cambia la frecuencia de muestreo declarada en la cabecera del WAV sin tocar las muestras
function cambiarTonoWav (wav, factor) {
  if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('El audio de Piper no es un WAV válido')
  }
  let posicion = 12
  while (posicion + 8 <= wav.length) {
    const nombre = wav.toString('ascii', posicion, posicion + 4)
    const tamano = wav.readUInt32LE(posicion + 4)
    if (nombre === 'fmt ') {
      const datos = posicion + 8
      const frecuencia = Math.round(wav.readUInt32LE(datos + 4) * factor)
      const alineacion = wav.readUInt16LE(datos + 12)
      const copia = Buffer.from(wav)
      copia.writeUInt32LE(frecuencia, datos + 4)
      copia.writeUInt32LE(frecuencia * alineacion, datos + 8)
      return copia
    }
    posicion += 8 + tamano + (tamano % 2)
  }
  throw new Error('El WAV de Piper no tiene bloque fmt')
}

// Una línea de texto limpia: Piper lee una petición por línea
function limpiarTexto (texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CARACTERES)
}

function crearSintetizadorPiper ({ binario, modelo, tono = 1.28, velocidad = 1.0, carpetaTemporal, lanzar = spawn } = {}) {
  const estaConfigurado = Boolean(binario && modelo && fs.existsSync(binario) && fs.existsSync(modelo))
  const carpeta = carpetaTemporal || path.join(os.tmpdir(), 'talking-thommy-voz')
  let proceso = null
  let pendientes = []
  let restoSalida = ''
  let ultimoError = null

  function fallarPendientes (error) {
    const lista = pendientes
    pendientes = []
    for (const pendiente of lista) {
      clearTimeout(pendiente.temporizador)
      pendiente.rechazar(error)
    }
  }

  function detener () {
    if (!proceso) return
    const actual = proceso
    proceso = null
    actual.stdin.end()
    actual.kill()
  }

  function alRecibirRuta (linea) {
    const pendiente = pendientes.shift()
    if (!pendiente) return
    clearTimeout(pendiente.temporizador)
    fs.promises.readFile(linea.trim())
      .then((wav) => {
        fs.promises.unlink(linea.trim()).catch(() => {})
        pendiente.resolver(tono === 1 ? wav : cambiarTonoWav(wav, tono))
      })
      .catch(pendiente.rechazar)
  }

  function arrancar () {
    if (proceso) return proceso
    fs.mkdirSync(carpeta, { recursive: true })
    const carpetaBinario = path.dirname(binario)
    proceso = lanzar(binario, [
      '--model', modelo,
      '--json-input',
      '--length_scale', String(velocidad * tono),
      '--output_dir', carpeta,
      '--quiet'
    ], {
      cwd: carpetaBinario,
      // En Linux, Piper busca sus librerías y espeak-ng-data junto al ejecutable
      env: { ...process.env, LD_LIBRARY_PATH: [carpetaBinario, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') },
      windowsHide: true
    })
    const actual = proceso
    restoSalida = ''
    actual.stdout.setEncoding('utf8')
    actual.stdout.on('data', (trozo) => {
      const lineas = (restoSalida + trozo).split(/\r?\n/)
      restoSalida = lineas.pop()
      lineas.filter((linea) => linea.trim()).forEach(alRecibirRuta)
    })
    actual.stderr.on('data', (trozo) => { ultimoError = String(trozo).trim().slice(-300) })
    actual.on('error', (error) => {
      ultimoError = error.message
      if (proceso === actual) proceso = null
      fallarPendientes(error)
    })
    actual.on('exit', (codigo) => {
      if (proceso === actual) proceso = null
      fallarPendientes(new Error(`Piper se cerró (código ${codigo})${ultimoError ? ': ' + ultimoError : ''}`))
    })
    return actual
  }

  // Devuelve un Buffer con el WAV de la voz de Thommy
  function sintetizar (texto) {
    const linea = limpiarTexto(texto)
    if (!estaConfigurado) return Promise.reject(new Error('Piper no está instalado'))
    if (!linea) return Promise.reject(new Error('Texto vacío'))

    return new Promise((resolve, reject) => {
      const actual = arrancar()
      const pendiente = { resolver: resolve, rechazar: reject }
      // Si Piper se atasca, se reinicia: las respuestas van en orden y una perdida desfasaría las demás
      pendiente.temporizador = setTimeout(() => {
        fallarPendientes(new Error('Piper tardó demasiado'))
        detener()
      }, TIEMPO_MAXIMO_MS)
      pendientes.push(pendiente)
      const archivo = path.join(carpeta, `${crypto.randomUUID()}.wav`)
      actual.stdin.write(JSON.stringify({ text: linea, output_file: archivo }) + '\n')
    })
  }

  return {
    estaConfigurado,
    sintetizar,
    // Carga la voz al arrancar el servidor para que el primer saludo no espere
    precalentar () {
      if (!estaConfigurado) return Promise.resolve(false)
      return sintetizar('Hi!').then(() => true, (error) => {
        console.warn('[voz] Piper no pudo arrancar:', error.message)
        return false
      })
    },
    estado () {
      return { estaConfigurada: estaConfigurado, motor: estaConfigurado ? 'piper' : 'navegador', ultimoError: estaConfigurado ? ultimoError : null }
    },
    detener
  }
}

module.exports = { crearSintetizadorPiper, cambiarTonoWav, limpiarTexto }
