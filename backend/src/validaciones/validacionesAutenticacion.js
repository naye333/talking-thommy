// Validaciones sin librerías externas. Cada función devuelve { datos, errores }.
const EXPRESION_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_CONTRASENA = 8
const MAX_CONTRASENA = 72 // límite de bcrypt

function esTextoConContenido (valor) {
  return typeof valor === 'string' && valor.trim().length > 0
}

function validarCorreoYContrasena (cuerpo, errores) {
  const correo = typeof cuerpo.correo === 'string' ? cuerpo.correo.trim().toLowerCase() : ''
  if (!EXPRESION_CORREO.test(correo)) errores.push({ campo: 'correo', mensaje: 'Correo no válido' })

  const contrasena = cuerpo.contrasena
  if (typeof contrasena !== 'string' || contrasena.length < MIN_CONTRASENA) {
    errores.push({ campo: 'contrasena', mensaje: `Mínimo ${MIN_CONTRASENA} caracteres` })
  } else if (contrasena.length > MAX_CONTRASENA) {
    errores.push({ campo: 'contrasena', mensaje: `Máximo ${MAX_CONTRASENA} caracteres` })
  }
  return { correo, contrasena }
}

function validarRegistro (cuerpo = {}) {
  const errores = []
  const { correo, contrasena } = validarCorreoYContrasena(cuerpo, errores)

  if (!esTextoConContenido(cuerpo.nombre) || cuerpo.nombre.trim().length > 100) {
    errores.push({ campo: 'nombre', mensaje: 'Nombre obligatorio (máximo 100 caracteres)' })
  }

  const nivel = Number(cuerpo.nivel)
  if (![1, 2].includes(nivel)) errores.push({ campo: 'nivel', mensaje: 'El nivel debe ser 1 o 2' })

  return {
    errores,
    datos: { nombre: esTextoConContenido(cuerpo.nombre) ? cuerpo.nombre.trim() : '', correo, contrasena, nivel }
  }
}

function validarIngreso (cuerpo = {}) {
  const errores = []
  const correo = typeof cuerpo.correo === 'string' ? cuerpo.correo.trim().toLowerCase() : ''
  if (!correo) errores.push({ campo: 'correo', mensaje: 'Correo obligatorio' })
  if (!esTextoConContenido(cuerpo.contrasena)) errores.push({ campo: 'contrasena', mensaje: 'Contraseña obligatoria' })
  return { errores, datos: { correo, contrasena: cuerpo.contrasena } }
}

module.exports = { validarRegistro, validarIngreso }
