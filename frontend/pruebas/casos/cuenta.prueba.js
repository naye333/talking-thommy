import { describir, afirmar } from '../marco.js'
import { crearServicioCuenta } from '../../js/servicios/servicioCuenta.js'
import { crearServicioAutenticacion } from '../../js/servicios/servicioAutenticacion.js'
import { crearServicioDocente } from '../../js/servicios/docente/servicioDocente.js'
import { validarCambioContrasena } from '../../js/perfiles/comun/pantallas/cuenta.js'
import { obtenerMensajeError } from '../../js/nucleo/mensajesError.js'

function crearClienteFalso (respuesta = {}) {
  const llamadas = []
  const registrar = (metodo) => async (ruta, cuerpo) => {
    llamadas.push({ metodo, ruta, cuerpo })
    return respuesta
  }
  return { llamadas, get: registrar('GET'), post: registrar('POST'), patch: registrar('PATCH'), delete: registrar('DELETE') }
}

describir('cuenta', (prueba) => {
  prueba('el servicio de cuenta llama a los endpoints correctos', async () => {
    const cliente = crearClienteFalso({ docente: { id: 1, nombre: 'Profe' }, codigo: 'ABC234' })
    const servicio = crearServicioCuenta(cliente)
    await servicio.cambiarContrasena({ contrasenaActual: 'a', contrasenaNueva: 'b' })
    afirmar.igual((await servicio.consultarMiGrupo()).nombre, 'Profe')
    afirmar.igual((await servicio.unirmeAGrupo('ABC234')).id, 1)
    afirmar.igual(await servicio.consultarCodigoGrupo(), 'ABC234')
    afirmar.igual(await servicio.regenerarCodigoGrupo(), 'ABC234')
    afirmar.profundo(cliente.llamadas.map((llamada) => `${llamada.metodo} ${llamada.ruta}`), [
      'PATCH /api/auth/contrasena',
      'GET /api/estudiante/grupo',
      'POST /api/estudiante/grupo',
      'GET /api/docente/grupo',
      'POST /api/docente/grupo/codigo'
    ])
    afirmar.profundo(cliente.llamadas[2].cuerpo, { codigo: 'ABC234' })
  })

  prueba('el registro envía el código de grupo solo si existe', async () => {
    const cliente = crearClienteFalso()
    const servicio = crearServicioAutenticacion(cliente)
    await servicio.registrar({ nombre: 'Ana', correo: 'a@b.co', contrasena: 'x', nivel: 1, codigoGrupo: '' })
    await servicio.registrar({ nombre: 'Ana', correo: 'a@b.co', contrasena: 'x', nivel: 1, codigoGrupo: 'ABC234' })
    afirmar.igual('codigoGrupo' in cliente.llamadas[0].cuerpo, false)
    afirmar.igual(cliente.llamadas[1].cuerpo.codigoGrupo, 'ABC234')
  })

  prueba('valida el cambio de contraseña', () => {
    afirmar.profundo(validarCambioContrasena({ contrasenaActual: 'vieja1234', contrasenaNueva: 'nueva1234', confirmacion: 'nueva1234' }), {})
    const errores = validarCambioContrasena({ contrasenaActual: '', contrasenaNueva: 'corta', confirmacion: 'otra' })
    afirmar.profundo(Object.keys(errores), ['contrasenaActual', 'contrasenaNueva', 'confirmacion'])
    afirmar.igual(validarCambioContrasena({ contrasenaActual: 'igual1234', contrasenaNueva: 'igual1234', confirmacion: 'igual1234' }).contrasenaNueva, 'Debe ser diferente de la actual.')
  })

  prueba('el docente genera una contraseña temporal (API y ejemplo)', async () => {
    const cliente = crearClienteFalso({ contrasenaTemporal: 'abc2345678' })
    const api = crearServicioDocente({ usarDatosEjemplo: false, cliente })
    afirmar.igual((await api.restablecerContrasena(4)).contrasenaTemporal, 'abc2345678')
    afirmar.igual(cliente.llamadas[0].ruta, '/api/docente/estudiantes/4/contrasena-temporal')
    const ejemplo = crearServicioDocente({ usarDatosEjemplo: true, demoraMs: 0 })
    afirmar.igual((await ejemplo.restablecerContrasena(1)).contrasenaTemporal, 'ejemplo2345')
  })

  prueba('traduce los códigos de error nuevos', () => {
    afirmar.verdadero(obtenerMensajeError({ codigo: 'DEMASIADOS_INTENTOS' }).includes('15 minutos'))
    afirmar.verdadero(obtenerMensajeError({ codigo: 'CODIGO_GRUPO_INVALIDO' }).includes('código'))
    afirmar.verdadero(obtenerMensajeError({ codigo: 'IA_LIMITE_ALCANZADO' }).includes('Thommy'))
  })
})
