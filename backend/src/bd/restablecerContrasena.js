// Cambia la contraseña de cualquier cuenta (por ejemplo, si el docente olvidó la suya).
// Uso: npm run restablecer-contrasena -- correo@usta.edu.co "NuevaContrasena"
const { cerrarPool } = require('../config/baseDatos')
const repositorioUsuarios = require('../repositorios/repositorioUsuarios')
const { cifrarContrasena } = require('../servicios/servicioAutenticacion')

async function restablecer ([correo, contrasena]) {
  if (!correo || !contrasena) throw new Error('Uso: npm run restablecer-contrasena -- correo "NuevaContrasena"')
  if (contrasena.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres')

  const usuario = await repositorioUsuarios.buscarPorCorreo(correo.trim().toLowerCase())
  if (!usuario) throw new Error(`No existe una cuenta con el correo ${correo}`)
  await repositorioUsuarios.actualizarContrasena(usuario.id, await cifrarContrasena(contrasena))
  console.log(`[cuenta] contraseña actualizada para ${usuario.correo} (${usuario.rol})`)
}

restablecer(process.argv.slice(2))
  .finally(cerrarPool)
  .catch((error) => {
    console.error('[cuenta] ERROR:', error.message)
    process.exitCode = 1
  })
