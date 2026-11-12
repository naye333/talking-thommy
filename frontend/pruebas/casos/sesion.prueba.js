import { describir, afirmar } from '../marco.js'
import { crearSesion, crearAlmacenSeguro, decodificarToken } from '../../js/nucleo/sesion.js'

// Arma un JWT de prueba (sin firma válida: el frontend no verifica la firma, eso lo hace el backend)
function crearToken (datos) {
  const base64Url = (objeto) => btoa(JSON.stringify(objeto)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url(datos)}.firma`
}

function crearAlmacenEnMemoria () {
  return crearAlmacenSeguro(() => null)
}

describir('sesion', (prueba) => {
  const AHORA = 1_700_000_000_000

  prueba('decodifica el contenido del token', () => {
    const datos = decodificarToken(crearToken({ sub: '7', rol: 'docente', nivel: null }))
    afirmar.profundo(datos, { sub: '7', rol: 'docente', nivel: null })
  })

  prueba('decodifica textos con tildes', () => {
    const token = crearToken({ sub: '1' }).split('.')
    const contenido = btoa(String.fromCharCode(...new TextEncoder().encode('{"nombre":"Sofía"}')))
    afirmar.igual(decodificarToken(`${token[0]}.${contenido}.x`).nombre, 'Sofía')
  })

  prueba('rechaza tokens mal formados', () => {
    afirmar.igual(decodificarToken('abc'), null)
    afirmar.igual(decodificarToken('a.%%%.c'), null)
    afirmar.igual(decodificarToken(undefined), null)
  })

  prueba('guarda y recupera una sesión vigente', () => {
    const sesion = crearSesion({ almacen: crearAlmacenEnMemoria(), ahora: () => AHORA })
    const token = crearToken({ sub: '3', rol: 'docente', exp: AHORA / 1000 + 60 })
    sesion.guardar({ token, usuario: { id: 3, nombre: 'Ana', rol: 'docente' } })
    afirmar.igual(sesion.obtenerToken(), token)
    afirmar.igual(sesion.obtenerUsuario().nombre, 'Ana')
  })

  prueba('descarta una sesión vencida', () => {
    const almacen = crearAlmacenEnMemoria()
    const sesion = crearSesion({ almacen, ahora: () => AHORA })
    sesion.guardar({ token: crearToken({ sub: '3', rol: 'docente', exp: AHORA / 1000 - 1 }), usuario: null })
    afirmar.igual(sesion.obtener(), null)
    afirmar.igual(almacen.leer('tt.sesion'), null)
  })

  prueba('sin usuario guardado, lo deduce del token', () => {
    const sesion = crearSesion({ almacen: crearAlmacenEnMemoria(), ahora: () => AHORA })
    sesion.guardar({ token: crearToken({ sub: '9', rol: 'estudiante', nivel: 1 }), usuario: null })
    afirmar.profundo(sesion.obtenerUsuario(), { id: 9, rol: 'estudiante', nivel: 1 })
  })

  prueba('cerrar elimina la sesión', () => {
    const sesion = crearSesion({ almacen: crearAlmacenEnMemoria(), ahora: () => AHORA })
    sesion.guardar({ token: crearToken({ sub: '1', rol: 'docente' }), usuario: null })
    sesion.cerrar()
    afirmar.igual(sesion.obtener(), null)
  })

  prueba('el almacén seguro sigue funcionando si localStorage lanza errores', () => {
    const almacen = crearAlmacenSeguro(() => { throw new Error('bloqueado') })
    almacen.escribir('clave', 'valor')
    afirmar.igual(almacen.leer('clave'), 'valor')
  })
})
