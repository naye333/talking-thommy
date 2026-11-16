// Asigna estudiantes a un docente para que aparezcan en su perfil.
// Uso: npm run asignar-docente -- docente@usta.edu.co estudiante1@correo.com estudiante2@correo.com
const { cerrarPool } = require('../config/baseDatos')
const repositorioUsuarios = require('../repositorios/repositorioUsuarios')

async function asignarDocente ([correoDocente, ...correosEstudiantes]) {
  if (!correoDocente || correosEstudiantes.length === 0) {
    throw new Error('Uso: npm run asignar-docente -- correoDocente correoEstudiante [correoEstudiante...]')
  }
  const docente = await repositorioUsuarios.buscarPorCorreo(correoDocente.trim().toLowerCase())
  if (!docente || docente.rol !== 'docente') throw new Error(`No existe un docente con el correo ${correoDocente}`)

  const correos = correosEstudiantes.map((correo) => correo.trim().toLowerCase())
  const actualizados = await repositorioUsuarios.asignarDocente(docente.id, correos)
  console.log(`[docente] ${actualizados} de ${correos.length} estudiantes asignados a ${docente.correo}`)
}

asignarDocente(process.argv.slice(2))
  .finally(cerrarPool)
  .catch((error) => {
    console.error('[docente] ERROR:', error.message)
    process.exitCode = 1
  })
