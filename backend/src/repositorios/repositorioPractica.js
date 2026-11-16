// Sesiones de práctica con Thommy y resultados de cada turno
const { obtenerPoolObligatorio } = require('../config/baseDatos')

async function crearSesion ({ estudianteId, temaId, fraseInicial }) {
  const { rows } = await obtenerPoolObligatorio().query(
    `INSERT INTO sesiones_practica (estudiante_id, tema_id, frase_inicial)
     VALUES ($1, $2, $3) RETURNING id, estudiante_id, tema_id, frase_inicial, iniciada_en`,
    [estudianteId, temaId, fraseInicial]
  )
  return mapearSesion(rows[0])
}

function mapearSesion (fila) {
  if (!fila) return null
  return {
    id: fila.id,
    estudianteId: fila.estudiante_id,
    temaId: fila.tema_id,
    fraseInicial: fila.frase_inicial,
    iniciadaEn: fila.iniciada_en
  }
}

async function buscarSesionPorId (id) {
  const { rows } = await obtenerPoolObligatorio().query(
    'SELECT id, estudiante_id, tema_id, frase_inicial, iniciada_en FROM sesiones_practica WHERE id = $1',
    [id]
  )
  return mapearSesion(rows[0])
}

async function guardarResultadoTurno (resultado) {
  const { rows } = await obtenerPoolObligatorio().query(
    `INSERT INTO resultados_turno
       (sesion_id, transcripcion, referencia, puntaje_pronunciacion, puntaje_vocabulario,
        puntaje_gramatica, puntaje_fluidez, palabras, errores, respuesta_tutor, frase_siguiente, latencia_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, creado_en`,
    [
      resultado.sesionId, resultado.transcripcion, resultado.referencia,
      resultado.puntajes.pronunciacion, resultado.puntajes.vocabulario,
      resultado.puntajes.gramatica, resultado.puntajes.fluidez,
      JSON.stringify(resultado.palabras), JSON.stringify(resultado.errores),
      resultado.respuestaTutor, resultado.fraseSiguiente, resultado.latenciaMs
    ]
  )
  return { id: rows[0].id, creadoEn: rows[0].creado_en }
}

// Últimos turnos de la sesión, del más antiguo al más reciente, para dar contexto al tutor
async function listarUltimosTurnos (sesionId, limite) {
  const { rows } = await obtenerPoolObligatorio().query(
    `SELECT transcripcion, respuesta_tutor, frase_siguiente FROM (
       SELECT transcripcion, respuesta_tutor, frase_siguiente, creado_en
         FROM resultados_turno WHERE sesion_id = $1
        ORDER BY creado_en DESC LIMIT $2
     ) ultimos ORDER BY creado_en`,
    [sesionId, limite]
  )
  return rows.map((fila) => ({
    transcripcion: fila.transcripcion,
    respuestaTutor: fila.respuesta_tutor,
    fraseSiguiente: fila.frase_siguiente
  }))
}

// Resultados de los estudiantes indicados entre dos fechas, con el tema practicado
async function listarResultados (estudiantesIds, desde, hasta) {
  const { rows } = await obtenerPoolObligatorio().query(
    `SELECT s.estudiante_id, s.tema_id, t.titulo AS tema_titulo, r.creado_en,
            r.puntaje_pronunciacion, r.puntaje_vocabulario, r.puntaje_gramatica, r.puntaje_fluidez,
            r.palabras, r.errores
       FROM resultados_turno r
       JOIN sesiones_practica s ON s.id = r.sesion_id
       LEFT JOIN temas t ON t.id = s.tema_id
      WHERE s.estudiante_id = ANY($1::int[]) AND r.creado_en >= $2 AND r.creado_en < $3
      ORDER BY r.creado_en`,
    [estudiantesIds, desde, hasta]
  )
  return rows.map((fila) => ({
    estudianteId: fila.estudiante_id,
    temaId: fila.tema_id,
    temaTitulo: fila.tema_titulo,
    creadoEn: new Date(fila.creado_en),
    puntajes: {
      pronunciacion: fila.puntaje_pronunciacion,
      vocabulario: fila.puntaje_vocabulario,
      gramatica: fila.puntaje_gramatica,
      fluidez: fila.puntaje_fluidez
    },
    palabras: fila.palabras,
    errores: fila.errores
  }))
}

module.exports = { crearSesion, buscarSesionPorId, guardarResultadoTurno, listarUltimosTurnos, listarResultados }
