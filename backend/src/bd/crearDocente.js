// Crea una cuenta de docente (el registro público solo crea estudiantes).
// Uso: npm run crear-docente -- correo@usta.edu.co "Nombre Apellido" "contrasena"
const { cerrarPool } = require('../config/baseDatos')
const repositorioUsuarios = require('../repositorios/repositorioUsuarios')
const { cifrarContrasena } = require('../servicios/servicioAutenticacion')

async function crearDocente ([correo, nombre, contrasena]) {
  if (!correo || !nombre || !contrasena) {
    throw new Error('Uso: npm run crear-docente -- correo "Nombre" "contrasena"')
  }
  if (contrasena.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres')

  const usuario = await repositorioUsuarios.crearUsuario({
    nombre,
    correo: correo.trim().toLowerCase(),
    hashContrasena: await cifrarContrasena(contrasena),
    rol: 'docente',
    nivel: null
  })
  console.log(`[docente] creado con id ${usuario.id}: ${usuario.correo}`)
}

crearDocente(process.argv.slice(2))
  .finally(cerrarPool)
  .catch((error) => {
    console.error('[docente] ERROR:', error.message)
    process.exitCode = 1
  })
