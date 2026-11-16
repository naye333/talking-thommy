const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const entorno = require('../config/entorno')
const repositorioUsuarios = require('../repositorios/repositorioUsuarios')
const servicioGrupos = require('./servicioGrupos')
const { crearError } = require('../utilidades/errores')

const RONDAS_CIFRADO = 10

function cifrarContrasena (contrasena) {
  return bcrypt.hash(contrasena, RONDAS_CIFRADO)
}

function generarToken (usuario) {
  return jwt.sign(
    { rol: usuario.rol, nivel: usuario.nivel },
    entorno.jwtSecreto,
    { subject: String(usuario.id), expiresIn: entorno.jwtExpiracion }
  )
}

// Devuelve { id, rol, nivel } o lanza TOKEN_INVALIDO
function verificarToken (token) {
  try {
    const datos = jwt.verify(token, entorno.jwtSecreto)
    return { id: Number(datos.sub), rol: datos.rol, nivel: datos.nivel }
  } catch {
    throw crearError(401, 'TOKEN_INVALIDO')
  }
}

// Nunca se devuelve el hash de la contraseña al cliente
function convertirUsuarioPublico (usuario) {
  const { hashContrasena, ...usuarioPublico } = usuario
  return usuarioPublico
}

// El registro público solo crea estudiantes; los docentes se crean con npm run crear-docente
// codigoGrupo es opcional: si llega, el estudiante queda asignado a ese docente
async function registrarEstudiante ({ nombre, correo, contrasena, nivel, codigoGrupo = null }) {
  const existente = await repositorioUsuarios.buscarPorCorreo(correo)
  if (existente) throw crearError(409, 'CORREO_EN_USO')

  const docente = codigoGrupo ? await servicioGrupos.buscarDocentePorCodigo(codigoGrupo) : null

  const usuario = await repositorioUsuarios.crearUsuario({
    nombre,
    correo,
    hashContrasena: await cifrarContrasena(contrasena),
    rol: 'estudiante',
    nivel,
    docenteId: docente ? docente.id : null
  })
  return { token: generarToken(usuario), usuario: convertirUsuarioPublico(usuario) }
}

async function iniciarSesion ({ correo, contrasena }) {
  const usuario = await repositorioUsuarios.buscarPorCorreo(correo)
  // Mismo error si no existe o si la contraseña falla, para no revelar qué correos existen
  const esContrasenaValida = usuario && await bcrypt.compare(contrasena, usuario.hashContrasena)
  if (!esContrasenaValida) throw crearError(401, 'CREDENCIALES_INVALIDAS')

  return { token: generarToken(usuario), usuario: convertirUsuarioPublico(usuario) }
}

async function obtenerUsuarioActual (id) {
  const usuario = await repositorioUsuarios.buscarPorId(id)
  if (!usuario) throw crearError(404, 'USUARIO_NO_ENCONTRADO')
  return convertirUsuarioPublico(usuario)
}

async function cambiarContrasena (id, { contrasenaActual, contrasenaNueva }) {
  const usuario = await repositorioUsuarios.buscarPorId(id)
  if (!usuario) throw crearError(404, 'USUARIO_NO_ENCONTRADO')
  const esValida = await bcrypt.compare(contrasenaActual, usuario.hashContrasena)
  if (!esValida) {
    throw crearError(400, 'CONTRASENA_INCORRECTA', [{ campo: 'contrasenaActual', mensaje: 'La contraseña actual no es correcta' }])
  }
  await repositorioUsuarios.actualizarContrasena(id, await cifrarContrasena(contrasenaNueva))
}

// Contraseña temporal fácil de dictar (sin caracteres que se confundan)
function generarContrasenaTemporal () {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789'
  let temporal = ''
  for (let i = 0; i < 10; i++) temporal += alfabeto[crypto.randomInt(alfabeto.length)]
  return temporal
}

async function restablecerContrasena (id) {
  const temporal = generarContrasenaTemporal()
  await repositorioUsuarios.actualizarContrasena(id, await cifrarContrasena(temporal))
  return temporal
}

module.exports = {
  cambiarContrasena,
  restablecerContrasena,
  generarContrasenaTemporal,
  cifrarContrasena,
  generarToken,
  verificarToken,
  registrarEstudiante,
  iniciarSesion,
  obtenerUsuarioActual
}
