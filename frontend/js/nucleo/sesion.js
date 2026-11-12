// Sesión del usuario: guarda el JWT que entrega /api/auth/ingreso y el usuario público.
// El token se verifica en el backend; aquí solo se lee su contenido para saber rol y expiración.

const CLAVE_SESION = 'tt.sesion'

function decodificarBase64Url (texto) {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/')
  const relleno = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binario = atob(relleno)
  const bytes = Uint8Array.from(binario, (caracter) => caracter.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// Devuelve el contenido del JWT ({ sub, rol, nivel, exp }) o null si no es válido
export function decodificarToken (token) {
  if (typeof token !== 'string') return null
  const partes = token.split('.')
  if (partes.length !== 3) return null
  try {
    return JSON.parse(decodificarBase64Url(partes[1]))
  } catch {
    return null
  }
}

// Envuelve localStorage: puede no existir o lanzar errores (modo privado, almacenamiento bloqueado)
export function crearAlmacenSeguro (obtenerAlmacen) {
  const enMemoria = new Map()
  function almacen () {
    try {
      return obtenerAlmacen() || null
    } catch {
      return null
    }
  }
  return {
    leer (clave) {
      try {
        const real = almacen()
        return real ? real.getItem(clave) : (enMemoria.get(clave) ?? null)
      } catch {
        return enMemoria.get(clave) ?? null
      }
    },
    escribir (clave, valor) {
      enMemoria.set(clave, valor)
      try { almacen()?.setItem(clave, valor) } catch { /* se conserva en memoria */ }
    },
    borrar (clave) {
      enMemoria.delete(clave)
      try { almacen()?.removeItem(clave) } catch { /* nada que borrar */ }
    }
  }
}

export function crearSesion ({ almacen, ahora = () => Date.now() }) {
  function leer () {
    const texto = almacen.leer(CLAVE_SESION)
    if (!texto) return null
    try {
      return JSON.parse(texto)
    } catch {
      return null
    }
  }

  function estaVigente (token) {
    const datos = decodificarToken(token)
    if (!datos) return false
    return !datos.exp || datos.exp * 1000 > ahora()
  }

  const sesion = {
    guardar ({ token, usuario }) {
      almacen.escribir(CLAVE_SESION, JSON.stringify({ token, usuario }))
    },

    // { token, usuario } si hay una sesión vigente; borra la sesión vencida
    obtener () {
      const guardada = leer()
      if (!guardada || !estaVigente(guardada.token)) {
        if (guardada) sesion.cerrar()
        return null
      }
      const datos = decodificarToken(guardada.token)
      const usuario = guardada.usuario || { id: Number(datos.sub), rol: datos.rol, nivel: datos.nivel }
      return { token: guardada.token, usuario }
    },

    obtenerToken () {
      return sesion.obtener()?.token ?? null
    },

    obtenerUsuario () {
      return sesion.obtener()?.usuario ?? null
    },

    actualizarUsuario (usuario) {
      const actual = leer()
      if (actual) sesion.guardar({ token: actual.token, usuario })
    },

    cerrar () {
      almacen.borrar(CLAVE_SESION)
    }
  }
  return sesion
}
