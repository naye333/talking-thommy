// Mini marco de pruebas sin dependencias: corre igual en Node (npm test) y en el navegador (pruebas/index.html).

const casos = []

export function describir (grupo, definir) {
  definir((nombre, ejecutar) => casos.push({ nombre: `${grupo} › ${nombre}`, ejecutar }))
}

function formatear (valor) {
  try {
    return JSON.stringify(valor)
  } catch {
    return String(valor)
  }
}

export const afirmar = {
  igual (real, esperado, mensaje = '') {
    if (!Object.is(real, esperado)) {
      throw new Error(`${mensaje} esperado ${formatear(esperado)}, recibido ${formatear(real)}`.trim())
    }
  },
  profundo (real, esperado, mensaje = '') {
    if (formatear(real) !== formatear(esperado)) {
      throw new Error(`${mensaje} esperado ${formatear(esperado)}, recibido ${formatear(real)}`.trim())
    }
  },
  verdadero (valor, mensaje = 'se esperaba un valor verdadero') {
    if (!valor) throw new Error(mensaje)
  },
  async rechaza (promesa, codigo) {
    try {
      await promesa
    } catch (error) {
      if (codigo && error.codigo !== codigo) {
        throw new Error(`se esperaba el código ${codigo}, recibido ${error.codigo}`)
      }
      return error
    }
    throw new Error(`se esperaba un rechazo${codigo ? ` con ${codigo}` : ''}`)
  }
}

export async function ejecutarPruebas () {
  const resultados = []
  for (const caso of casos) {
    try {
      await caso.ejecutar()
      resultados.push({ nombre: caso.nombre, aprobada: true })
    } catch (error) {
      resultados.push({ nombre: caso.nombre, aprobada: false, error: error.message })
    }
  }
  return resultados
}
