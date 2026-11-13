import { describir, afirmar } from '../marco.js'
import { crearClienteApi } from '../../js/nucleo/clienteApi.js'
import { obtenerMensajeError, agruparDetallesPorCampo } from '../../js/nucleo/mensajesError.js'

function respuestaFalsa (estado, cuerpo) {
  return {
    ok: estado >= 200 && estado < 300,
    status: estado,
    json: async () => {
      if (cuerpo === undefined) throw new Error('sin cuerpo')
      return cuerpo
    }
  }
}

describir('clienteApi', (prueba) => {
  prueba('envía el token y el cuerpo JSON', async () => {
    let solicitud
    const cliente = crearClienteApi({
      urlBase: 'http://api',
      obtenerToken: () => 'abc',
      fetchImpl: async (url, opciones) => {
        solicitud = { url, opciones }
        return respuestaFalsa(200, { ok: true })
      }
    })
    const datos = await cliente.post('/api/auth/ingreso', { correo: 'a@b.co' })
    afirmar.profundo(datos, { ok: true })
    afirmar.igual(solicitud.url, 'http://api/api/auth/ingreso')
    afirmar.igual(solicitud.opciones.method, 'POST')
    afirmar.igual(solicitud.opciones.headers.Authorization, 'Bearer abc')
    afirmar.igual(solicitud.opciones.body, '{"correo":"a@b.co"}')
  })

  prueba('convierte la respuesta de error del backend en ErrorApi', async () => {
    const cliente = crearClienteApi({
      urlBase: '',
      fetchImpl: async () => respuestaFalsa(400, { error: 'DATOS_INVALIDOS', detalles: [{ campo: 'correo', mensaje: 'Correo no válido' }] })
    })
    const error = await afirmar.rechaza(cliente.get('/x'), 'DATOS_INVALIDOS')
    afirmar.igual(error.estado, 400)
    afirmar.profundo(agruparDetallesPorCampo(error), { correo: 'Correo no válido' })
  })

  prueba('avisa cuando el token ya no es válido', async () => {
    let avisos = 0
    const cliente = crearClienteApi({
      urlBase: '',
      alSesionInvalida: () => { avisos += 1 },
      fetchImpl: async () => respuestaFalsa(401, { error: 'TOKEN_INVALIDO' })
    })
    await afirmar.rechaza(cliente.get('/api/auth/yo'), 'TOKEN_INVALIDO')
    afirmar.igual(avisos, 1)
  })

  prueba('las credenciales incorrectas no cierran la sesión', async () => {
    let avisos = 0
    const cliente = crearClienteApi({
      urlBase: '',
      alSesionInvalida: () => { avisos += 1 },
      fetchImpl: async () => respuestaFalsa(401, { error: 'CREDENCIALES_INVALIDAS' })
    })
    await afirmar.rechaza(cliente.post('/api/auth/ingreso', {}), 'CREDENCIALES_INVALIDAS')
    afirmar.igual(avisos, 0)
  })

  prueba('un fallo de red se reporta como SIN_CONEXION', async () => {
    const cliente = crearClienteApi({ urlBase: '', fetchImpl: async () => { throw new TypeError('Failed to fetch') } })
    const error = await afirmar.rechaza(cliente.get('/x'), 'SIN_CONEXION')
    afirmar.igual(obtenerMensajeError(error), 'No pudimos conectar con el servidor. Revisa tu conexión.')
  })

  prueba('una respuesta sin JSON se reporta como ERROR_INTERNO', async () => {
    const cliente = crearClienteApi({ urlBase: '', fetchImpl: async () => respuestaFalsa(502) })
    await afirmar.rechaza(cliente.get('/x'), 'ERROR_INTERNO')
  })
})
