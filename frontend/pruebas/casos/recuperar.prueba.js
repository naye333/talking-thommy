import { describir, afirmar } from '../marco.js'
import { crearServicioAutenticacion } from '../../js/servicios/servicioAutenticacion.js'
import { validarPasoVerificacion, validarPasoContrasena } from '../../js/perfiles/comun/pantallas/recuperar.js'
import { obtenerMensajeError } from '../../js/nucleo/mensajesError.js'

function crearClienteFalso () {
  const llamadas = []
  const registrar = (metodo) => async (ruta, cuerpo) => {
    llamadas.push({ metodo, ruta, cuerpo })
    return {}
  }
  return { llamadas, get: registrar('GET'), post: registrar('POST') }
}

describir('recuperar contraseña', (prueba) => {
  prueba('el servicio llama a los endpoints de captcha y recuperación', async () => {
    const cliente = crearClienteFalso()
    const servicio = crearServicioAutenticacion(cliente)
    await servicio.pedirCaptcha()
    await servicio.verificarRecuperacion({ correo: 'a@b.co', codigoGrupo: 'ABC234', captchaId: 'id', captchaRespuesta: 'K7MPA', extra: 'no' })
    await servicio.cambiarContrasenaOlvidada({ tokenRecuperacion: 't', contrasenaNueva: 'NuevaClave1' })
    afirmar.profundo(cliente.llamadas.map((llamada) => `${llamada.metodo} ${llamada.ruta}`), [
      'GET /api/auth/captcha',
      'POST /api/auth/recuperar/verificar',
      'POST /api/auth/recuperar/cambiar'
    ])
    afirmar.profundo(cliente.llamadas[1].cuerpo, { correo: 'a@b.co', codigoGrupo: 'ABC234', captchaId: 'id', captchaRespuesta: 'K7MPA' })
  })

  prueba('el paso 1 exige correo válido, captcha y código de la clase', () => {
    const errores = validarPasoVerificacion({ correo: 'malo', captchaRespuesta: '', codigoGrupo: '' })
    afirmar.profundo(Object.keys(errores).sort(), ['captchaRespuesta', 'codigoGrupo', 'correo'])
    afirmar.profundo(validarPasoVerificacion({ correo: 'a@b.co', captchaRespuesta: 'K7MPA', codigoGrupo: 'ABC234' }), {})
  })

  prueba('el paso 2 exige 8 caracteres y que coincidan', () => {
    afirmar.verdadero(validarPasoContrasena({ contrasenaNueva: 'corta', confirmacion: 'corta' }).contrasenaNueva)
    afirmar.verdadero(validarPasoContrasena({ contrasenaNueva: 'NuevaClave1', confirmacion: 'otra' }).confirmacion)
    afirmar.profundo(validarPasoContrasena({ contrasenaNueva: 'NuevaClave1', confirmacion: 'NuevaClave1' }), {})
  })

  prueba('los errores nuevos tienen mensaje propio', () => {
    for (const codigo of ['CAPTCHA_INCORRECTO', 'VERIFICACION_FALLIDA', 'RECUPERACION_VENCIDA']) {
      afirmar.verdadero(obtenerMensajeError({ codigo }) !== obtenerMensajeError({ codigo: 'ERROR_INTERNO' }), codigo)
    }
  })
})
