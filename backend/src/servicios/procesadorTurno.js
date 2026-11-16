// Flujo completo de un turno: audio → transcripción → tutor → análisis fonético → evaluación
const entorno = require('../config/entorno')
const clienteGroq = require('./ia/clienteGroq')
const servicioTutor = require('./servicioTutor')
const repositorioPractica = require('../repositorios/repositorioPractica')
const { compararPronunciacion } = require('./analisisFonetico')
const { calcularFluidez, construirEvaluacion } = require('./servicioEvaluacion')
const { crearError } = require('../utilidades/errores')

// Las dependencias se inyectan para poder probar el flujo sin red ni base de datos
function crearProcesadorTurno ({ ia = clienteGroq, tutor = servicioTutor, repositorio = repositorioPractica } = {}) {
  // contexto: { sesion, tema, nivel, fraseActual } (fraseActual se actualiza tras cada turno)
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
      fraseObjetivo: contexto.fraseActual
    }, ia)

    // Con frase propuesta se compara contra ella; en conversación libre, contra la versión corregida
    const referencia = contexto.fraseActual || respuestaTutor.correccion
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

    contexto.fraseActual = respuestaTutor.frase
    return {
      tipo: 'resultado_turno',
      transcripcion: transcripcion.texto,
      evaluacion,
      respuesta: { texto: respuestaTutor.respuesta, frase: respuestaTutor.frase, audioUrl: null },
      latenciaMs
    }
  }
}

module.exports = { crearProcesadorTurno }
