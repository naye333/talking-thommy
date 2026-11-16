// Cuenta del usuario: cambio de contraseña y grupo docente-estudiantes (backend/src/rutas/autenticacion.js,
// estudiante.js y docente.js)

export function crearServicioCuenta (cliente) {
  return {
    // PATCH /api/auth/contrasena → 204
    cambiarContrasena ({ contrasenaActual, contrasenaNueva }) {
      return cliente.patch('/api/auth/contrasena', { contrasenaActual, contrasenaNueva })
    },

    // Estudiante: GET /api/estudiante/grupo → docente { id, nombre } o null
    async consultarMiGrupo () {
      return (await cliente.get('/api/estudiante/grupo')).docente
    },

    // Estudiante: POST /api/estudiante/grupo { codigo } → docente { id, nombre }
    async unirmeAGrupo (codigo) {
      return (await cliente.post('/api/estudiante/grupo', { codigo })).docente
    },

    // Docente: GET /api/docente/grupo → código que comparte con sus estudiantes
    async consultarCodigoGrupo () {
      return (await cliente.get('/api/docente/grupo')).codigo
    },

    // Docente: POST /api/docente/grupo/codigo → código nuevo (los estudiantes ya unidos se mantienen)
    async regenerarCodigoGrupo () {
      return (await cliente.post('/api/docente/grupo/codigo')).codigo
    }
  }
}
