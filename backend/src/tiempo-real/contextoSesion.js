// Carga lo que el turno necesita saber de la sesión y verifica que pertenece al estudiante
const repositorioPractica = require('../repositorios/repositorioPractica')
const repositorioSyllabus = require('../repositorios/repositorioSyllabus')
const { construirSaludo } = require('../servicios/servicioTutor')
const { crearError } = require('../utilidades/errores')

async function cargarContextoSesion (usuario, sesionIdTexto) {
  if (usuario.rol !== 'estudiante') throw crearError(403, 'PERMISO_DENEGADO')

  const sesionId = Number(sesionIdTexto)
  const sesion = Number.isInteger(sesionId) && sesionId > 0
    ? await repositorioPractica.buscarSesionPorId(sesionId)
    : null
  // Misma respuesta si no existe o es de otro estudiante, para no revelar sesiones ajenas
  if (!sesion || sesion.estudianteId !== usuario.id) throw crearError(404, 'SESION_NO_ENCONTRADA')

  const tema = sesion.temaId ? await repositorioSyllabus.buscarTemaPorId(sesion.temaId) : null
  // El saludo se reconstruye igual que al crear la sesión: es la pregunta con la que abrió Thommy
  return { sesion, tema, nivel: usuario.nivel, saludo: construirSaludo(tema).texto }
}

module.exports = { cargarContextoSesion }
