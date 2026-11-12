// Endpoints reales de autenticación del backend (backend/src/rutas/autenticacion.js)

export function crearServicioAutenticacion (cliente) {
  return {
    // POST /api/auth/ingreso → { token, usuario }
    ingresar ({ correo, contrasena }) {
      return cliente.post('/api/auth/ingreso', { correo, contrasena })
    },

    // GET /api/auth/yo → usuario público { id, nombre, correo, rol, nivel, creadoEn }
    async consultarUsuarioActual () {
      const { usuario } = await cliente.get('/api/auth/yo')
      return usuario
    }
  }
}
