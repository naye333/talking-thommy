// Mide la calidad de la transcripción y la latencia con audios grabados por estudiantes.
// Es la evidencia de las métricas de calidad (ver docs/metricas-calidad.md).
//
// Uso: npm run medir-calidad -- ruta/a/carpeta [--con-tutor]
//   La carpeta debe tener casos.json: [{ "audio": "frase1.m4a", "texto": "Nice to meet you." }, ...]
//   --con-tutor también mide la respuesta de Thommy (gasta más cuota de Groq).
// Requiere GROQ_API_KEY en el .env. Deja el resultado en la carpeta como reporte-calidad-<fecha>.json.
const fs = require('fs')
const path = require('path')
const { transcribirAudio } = require('../servicios/ia/clienteGroq')
const { responderTurno } = require('../servicios/servicioTutor')
const { compararPronunciacion } = require('../servicios/analisisFonetico')
const { calcularWer, percentil, promedio } = require('../servicios/metricas')

function leerCasos (carpeta) {
  const archivo = path.join(carpeta, 'casos.json')
  if (!fs.existsSync(archivo)) throw new Error(`No existe ${archivo}. Mira el formato en docs/metricas-calidad.md`)
  const casos = JSON.parse(fs.readFileSync(archivo, 'utf8'))
  if (!Array.isArray(casos) || casos.length === 0) throw new Error('casos.json debe ser una lista con al menos un caso')
  return casos
}

// Solo nombres de archivo dentro de la carpeta de casos (sin rutas como ../../otro)
function rutaAudio (carpeta, nombre) {
  if (typeof nombre !== 'string' || nombre !== path.basename(nombre)) {
    throw new Error(`"${nombre}" debe ser solo el nombre de un archivo de la carpeta`)
  }
  return path.join(path.resolve(carpeta), nombre)
}

async function medirCaso (carpeta, caso, conTutor) {
  const audio = fs.readFileSync(rutaAudio(carpeta, caso.audio))
  const inicio = Date.now()
  const transcripcion = await transcribirAudio(audio)
  const latenciaTranscripcionMs = Date.now() - inicio

  let latenciaTutorMs = null
  if (conTutor) {
    const inicioTutor = Date.now()
    await responderTurno({ tema: null, nivel: 1, transcripcion: transcripcion.texto, fraseObjetivo: caso.texto })
    latenciaTutorMs = Date.now() - inicioTutor
  }

  return {
    audio: caso.audio,
    esperado: caso.texto,
    transcripcion: transcripcion.texto,
    wer: Number(calcularWer(caso.texto, transcripcion.texto).toFixed(3)),
    puntajePronunciacion: compararPronunciacion(caso.texto, transcripcion.texto).puntaje,
    latenciaTranscripcionMs,
    latenciaTutorMs
  }
}

function resumir (resultados) {
  const exitosos = resultados.filter((resultado) => !resultado.error)
  const latencias = exitosos.map((resultado) => resultado.latenciaTranscripcionMs + (resultado.latenciaTutorMs || 0))
  const redondear = (valor) => (valor === null ? null : Math.round(valor))
  return {
    casos: resultados.length,
    fallidos: resultados.length - exitosos.length,
    werPromedio: exitosos.length ? Number(promedio(exitosos.map((r) => r.wer)).toFixed(3)) : null,
    casosSinErrores: exitosos.filter((r) => r.wer === 0).length,
    puntajePronunciacionPromedio: redondear(promedio(exitosos.map((r) => r.puntajePronunciacion))),
    latenciaMs: { p50: redondear(percentil(latencias, 50)), p95: redondear(percentil(latencias, 95)), maxima: latencias.length ? Math.max(...latencias) : null }
  }
}

async function medirCalidad (argumentos) {
  const carpeta = argumentos.find((argumento) => !argumento.startsWith('--'))
  if (!carpeta) throw new Error('Uso: npm run medir-calidad -- ruta/a/carpeta [--con-tutor]')
  const conTutor = argumentos.includes('--con-tutor')
  const casos = leerCasos(carpeta)

  const resultados = []
  for (const caso of casos) {
    try {
      const resultado = await medirCaso(carpeta, caso, conTutor)
      resultados.push(resultado)
      console.log(`✔ ${caso.audio}: WER ${(resultado.wer * 100).toFixed(0)}% · ${resultado.latenciaTranscripcionMs} ms · "${resultado.transcripcion}"`)
    } catch (error) {
      resultados.push({ audio: caso.audio, esperado: caso.texto, error: error.codigo || error.message })
      console.log(`✘ ${caso.audio}: ${error.codigo || error.message}`)
    }
  }

  const resumen = resumir(resultados)
  const archivo = path.join(carpeta, `reporte-calidad-${new Date().toISOString().slice(0, 10)}.json`)
  fs.writeFileSync(archivo, JSON.stringify({ fecha: new Date().toISOString(), conTutor, resumen, resultados }, null, 2))
  console.log('\nResumen:', JSON.stringify(resumen, null, 2))
  console.log(`Reporte guardado en ${archivo}`)
  return { resumen, resultados }
}

if (require.main === module) {
  medirCalidad(process.argv.slice(2)).catch((error) => {
    console.error('[calidad] ERROR:', error.message)
    process.exitCode = 1
  })
}

module.exports = { medirCalidad, resumir }
