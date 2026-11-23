// Endpoints reales de autenticación del backend (backend/src/rutas/autenticacion.js)

export function crearServicioAutenticacion (cliente) {
  return {
    // POST /api/auth/ingreso → { token, usuario }
    ingresar ({ correo, contrasena }) {
      return cliente.post('/api/auth/ingreso', { correo, contrasena })
    },

    // POST /api/auth/registro → 201 { token, usuario }. Solo crea estudiantes; nivel 1 o 2.
    // codigoGrupo (opcional) deja al estudiante en el grupo de su docente.
    registrar ({ nombre, correo, contrasena, nivel, codigoGrupo }) {
      const cuerpo = { nombre, correo, contrasena, nivel }
      if (codigoGrupo) cuerpo.codigoGrupo = codigoGrupo
      return cliente.post('/api/auth/registro', cuerpo)
    },

    // ¿Olvidaste tu contraseña? GET /api/auth/captcha → { captchaId, imagen (data URL) }
    pedirCaptcha () {
      return cliente.get('/api/auth/captcha')
    },

    // POST /api/auth/recuperar/verificar → { tokenRecuperacion, nombre }
    verificarRecuperacion ({ correo, codigoGrupo, captchaId, captchaRespuesta }) {
      return cliente.post('/api/auth/recuperar/verificar', { correo, codigoGrupo, captchaId, captchaRespuesta })
    },

    // POST /api/auth/recuperar/cambiar → 204
    cambiarContrasenaOlvidada ({ tokenRecuperacion, contrasenaNueva }) {
      return cliente.post('/api/auth/recuperar/cambiar', { tokenRecuperacion, contrasenaNueva })
    },

    // GET /api/auth/yo → usuario público { id, nombre, correo, rol, nivel, creadoEn }
    async consultarUsuarioActual () {
      const { usuario } = await cliente.get('/api/auth/yo')
      return usuario
    }
  }
}
