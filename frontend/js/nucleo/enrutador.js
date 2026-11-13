// Enrutador por hash (#/ruta?clave=valor). Funciona sin servidor especial y en cualquier hosting estático.

// Convierte '/docente/estudiantes/:id' en una expresión regular y la lista de parámetros
export function compilarPatron (patron) {
  const claves = []
  const fuente = patron
    .split('/')
    .map((segmento) => {
      if (segmento.startsWith(':')) {
        claves.push(segmento.slice(1))
        return '([^/]+)'
      }
      return segmento.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  return { expresion: new RegExp(`^${fuente}/?$`), claves }
}

// '#/docente/reporte?periodo=semestre' → { ruta: '/docente/reporte', query: { periodo: 'semestre' } }
export function analizarHash (hash) {
  const sinAlmohadilla = (hash || '').replace(/^#/, '')
  const [ruta, cadenaQuery = ''] = sinAlmohadilla.split('?')
  return {
    ruta: ruta && ruta.startsWith('/') ? ruta : '/',
    query: Object.fromEntries(new URLSearchParams(cadenaQuery))
  }
}

export function resolverRuta (rutas, ruta) {
  for (const definicion of rutas) {
    const coincidencia = definicion.compilado.expresion.exec(ruta)
    if (!coincidencia) continue
    const params = {}
    definicion.compilado.claves.forEach((clave, indice) => {
      params[clave] = decodeURIComponent(coincidencia[indice + 1])
    })
    return { definicion, params }
  }
  return null
}

// Arma '/ruta?clave=valor' omitiendo valores vacíos
export function construirRuta (ruta, query = {}) {
  const parametros = new URLSearchParams(Object.entries(query).filter(([, valor]) => valor !== undefined && valor !== null && valor !== ''))
  const cadena = parametros.toString()
  return cadena ? `${ruta}?${cadena}` : ruta
}

// Cambia la query del hash sin volver a montar la pantalla (por ejemplo, al elegir un periodo)
export function reemplazarQuery (ruta, query, ventana = window) {
  ventana.history.replaceState(null, '', `#${construirRuta(ruta, query)}`)
}

export function prepararRutas (rutas) {
  return rutas.map((definicion) => ({ ...definicion, compilado: compilarPatron(definicion.patron) }))
}

// rutas: [{ patron, pantalla, perfil? }]
// antesDeEntrar(definicion) → ruta a la que redirigir, o null para continuar
// alNoEncontrar → pantalla para rutas desconocidas
export function crearEnrutador ({ rutas, contenedor, antesDeEntrar = () => null, alNoEncontrar, ventana = window }) {
  const rutasPreparadas = prepararRutas(rutas)
  let limpiarPantallaActual = null
  // Entradas del historial creadas dentro de la app (enlaces o navegar); permite saber si "atrás" sigue en la app
  let entradasPropias = 0
  let estaRetrocediendo = false

  function navegar (ruta, { reemplazar = false } = {}) {
    const destino = `#${ruta}`
    if (reemplazar || ventana.location.hash === destino) {
      ventana.history.replaceState(null, '', destino)
      procesarCambio()
      return
    }
    ventana.location.hash = destino
  }

  // Vuelve a la pantalla anterior; si se entró directo por URL, va a la ruta de respaldo
  function atras (rutaRespaldo = '/') {
    if (entradasPropias > 0) {
      entradasPropias -= 1
      estaRetrocediendo = true
      ventana.history.back()
      return
    }
    navegar(rutaRespaldo, { reemplazar: true })
  }

  function alCambiarHash () {
    if (estaRetrocediendo) estaRetrocediendo = false
    else entradasPropias += 1
    procesarCambio()
  }

  async function procesarCambio () {
    const { ruta, query } = analizarHash(ventana.location.hash)
    const resultado = resolverRuta(rutasPreparadas, ruta)

    if (resultado) {
      const redireccion = antesDeEntrar(resultado.definicion, ruta)
      if (redireccion && redireccion !== ruta) {
        navegar(redireccion, { reemplazar: true })
        return
      }
    }

    if (limpiarPantallaActual) {
      limpiarPantallaActual()
      limpiarPantallaActual = null
    }

    // Cada pantalla recibe su propio elemento: si una carga lenta termina después de navegar,
    // escribe sobre un elemento que ya no está en el documento y no afecta a la pantalla nueva
    const elemento = ventana.document.createElement('div')
    elemento.className = 'vista'
    contenedor.replaceChildren(elemento)
    ventana.scrollTo(0, 0)

    const pantalla = resultado ? resultado.definicion.pantalla : alNoEncontrar
    const limpieza = await pantalla({
      contenedor: elemento,
      params: resultado ? resultado.params : {},
      query,
      ruta,
      navegar,
      atras
    })
    if (typeof limpieza === 'function') {
      if (elemento.isConnected) limpiarPantallaActual = limpieza
      else limpieza()
    }
  }

  return {
    iniciar () {
      ventana.addEventListener('hashchange', alCambiarHash)
      procesarCambio()
    },
    navegar,
    atras
  }
}
