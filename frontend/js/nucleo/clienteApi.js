// Cliente HTTP para la API REST del backend.
// Las respuestas de error del backend tienen la forma { error: CODIGO, detalles?: [{ campo, mensaje }] }.

export class ErrorApi extends Error {
  constructor ({ codigo, estado = 0, detalles = [] }) {
    super(codigo)
    this.name = 'ErrorApi'
    this.codigo = codigo
    this.estado = estado
    this.detalles = detalles
  }
}

const CODIGOS_SESION_INVALIDA = ['TOKEN_INVALIDO', 'TOKEN_REQUERIDO']

export function crearClienteApi ({ urlBase, obtenerToken = () => null, alSesionInvalida = () => {}, fetchImpl = globalThis.fetch }) {
  async function solicitar (metodo, ruta, { cuerpo } = {}) {
    const encabezados = { Accept: 'application/json' }
    const token = obtenerToken()
    if (token) encabezados.Authorization = `Bearer ${token}`
    if (cuerpo !== undefined) encabezados['Content-Type'] = 'application/json'

    let respuesta
    try {
      respuesta = await fetchImpl(`${urlBase}${ruta}`, {
        method: metodo,
        headers: encabezados,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
      })
    } catch {
      throw new ErrorApi({ codigo: 'SIN_CONEXION' })
    }

    let datos = null
    try {
      datos = await respuesta.json()
    } catch {
      datos = null
    }

    if (!respuesta.ok) {
      const codigo = datos?.error || 'ERROR_INTERNO'
      if (respuesta.status === 401 && CODIGOS_SESION_INVALIDA.includes(codigo)) alSesionInvalida()
      throw new ErrorApi({ codigo, estado: respuesta.status, detalles: datos?.detalles || [] })
    }
    return datos
  }

  return {
    get: (ruta) => solicitar('GET', ruta),
    post: (ruta, cuerpo) => solicitar('POST', ruta, { cuerpo })
  }
}
