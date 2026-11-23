// Flujo completo de un turno: audio → transcripción → tutor → análisis fonético → evaluación
const entorno = require('../config/entorno')
const clienteGroq = require('./ia/clienteGroq')
const servicioTutor = require('./servicioTutor')
const { servicioVoz } = require('./voz/servicioVoz')
const repositorioPractica = require('../repositorios/repositorioPractica')
const { compararPronunciacion } = require('./analisisFonetico')
const { calcularFluidez, construirEvaluacion } = require('./servicioEvaluacion')
const { crearError } = require('../utilidades/errores')

// Las dependencias se inyectan para poder probar el flujo sin red ni base de datos
function crearProcesadorTurno ({ ia = clienteGroq, tutor = servicioTutor, repositorio = repositorioPractica, voz = servicioVoz } = {}) {
  // contexto: { sesion, tema, nivel, saludo } (saludo: lo primero que dijo Thommy en la sesión)
  return async function procesarTurno (audio, contexto) {
    const inicio = Date.now()
    const transcripcion = await ia.transcribirAudio(audio)
    if (!transcripcion.texto) throw crearError(422, 'TRANSCRIPCION_VACIA')

    const historial = await repositorio.listarUltimosTurnos(contexto.sesion.id, entorno.maxTurnosHistorial)
    const respuestaTutor = await tutor.responderTurno({
      tema: contexto.tema,
      nivel: contexto.nivel,
      historial,
      transcripcion: transcripcion.texto,
      saludo: contexto.saludo
    }, ia)

    // En conversación no hay frase para repetir: se compara contra la versión corregida de lo que dijo
    const referencia = respuestaTutor.correccion
    const pronunciacion = compararPronunciacion(referencia, transcripcion.texto)
    const evaluacion = construirEvaluacion({ pronunciacion, errores: respuestaTutor.errores })
    const latenciaMs = Date.now() - inicio

    try {
      await repositorio.guardarResultadoTurno({
        sesionId: contexto.sesion.id,
        transcripcion: transcripcion.texto,
        referencia,
        puntajes: {
          pronunciacion: pronunciacion.puntaje,
          vocabulario: respuestaTutor.puntajeVocabulario,
          gramatica: respuestaTutor.puntajeGramatica,
          fluidez: calcularFluidez(transcripcion)
        },
        palabras: pronunciacion.palabras,
        errores: respuestaTutor.errores,
        respuestaTutor: respuestaTutor.respuesta,
        fraseSiguiente: respuestaTutor.frase,
        latenciaMs
      })
    } catch (error) {
      // El estudiante igual recibe su resultado; solo se pierde el registro para los reportes
      console.error('[turno] no se pudo guardar el resultado:', error.message)
    }

    return {
      tipo: 'resultado_turno',
      transcripcion: transcripcion.texto,
      evaluacion,
      // El audio se genera en segundo plano: la app lo descarga de audioUrl (null si no hay Piper)
      respuesta: { texto: respuestaTutor.respuesta, frase: null, audioUrl: voz.prepararAudio(respuestaTutor.respuesta) },
      latenciaMs
    }
  }
}

module.exports = { crearProcesadorTurno }
