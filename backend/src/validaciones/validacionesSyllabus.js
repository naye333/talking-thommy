// Valida la estructura del archivo de syllabus antes de cargarlo a la base de datos.
// Devuelve una lista de errores legibles; vacía si el archivo está bien.

function esTexto (valor) {
  return typeof valor === 'string' && valor.trim().length > 0
}

function esEnteroPositivo (valor) {
  return Number.isInteger(valor) && valor > 0
}

function esListaDeTextos (valor) {
  return Array.isArray(valor) && valor.every(esTexto)
}

function validarTema (tema, ruta, errores) {
  if (!esEnteroPositivo(tema.numero)) errores.push(`${ruta}.numero debe ser un entero positivo`)
  if (tema.semana !== undefined && !(Number.isInteger(tema.semana) && tema.semana >= 1 && tema.semana <= 20)) {
    errores.push(`${ruta}.semana debe ser un entero entre 1 y 20`)
  }
  if (!esTexto(tema.titulo)) errores.push(`${ruta}.titulo es obligatorio`)
  if (!esTexto(tema.objetivo)) errores.push(`${ruta}.objetivo es obligatorio`)
  for (const campo of ['gramatica', 'vocabulario', 'frasesModelo']) {
    if (!esListaDeTextos(tema[campo]) || tema[campo].length === 0) {
      errores.push(`${ruta}.${campo} debe ser una lista de textos con al menos un elemento`)
    }
  }
}

function validarUnidad (unidad, ruta, errores) {
  if (![1, 2].includes(unidad.nivel)) errores.push(`${ruta}.nivel debe ser 1 o 2`)
  if (!esEnteroPositivo(unidad.numero)) errores.push(`${ruta}.numero debe ser un entero positivo`)
  if (!esTexto(unidad.titulo)) errores.push(`${ruta}.titulo es obligatorio`)
  if (!Array.isArray(unidad.temas) || unidad.temas.length === 0) {
    errores.push(`${ruta}.temas debe tener al menos un tema`)
    return
  }

  const numerosTema = new Set()
  unidad.temas.forEach((tema, indice) => {
    const rutaTema = `${ruta}.temas[${indice}]`
    if (!tema || typeof tema !== 'object') return errores.push(`${rutaTema} no es un objeto`)
    validarTema(tema, rutaTema, errores)
    if (numerosTema.has(tema.numero)) errores.push(`${rutaTema}.numero ${tema.numero} está repetido en la unidad`)
    numerosTema.add(tema.numero)
  })
}

function validarSyllabus (datos) {
  const errores = []
  if (!datos || !Array.isArray(datos.unidades) || datos.unidades.length === 0) {
    return ['El archivo debe tener una lista "unidades" con al menos una unidad']
  }

  const clavesUnidad = new Set()
  datos.unidades.forEach((unidad, indice) => {
    const ruta = `unidades[${indice}]`
    if (!unidad || typeof unidad !== 'object') return errores.push(`${ruta} no es un objeto`)
    validarUnidad(unidad, ruta, errores)
    const clave = `${unidad.nivel}-${unidad.numero}`
    if (clavesUnidad.has(clave)) errores.push(`${ruta}: la unidad ${unidad.numero} del nivel ${unidad.nivel} está repetida`)
    clavesUnidad.add(clave)
  })
  return errores
}

module.exports = { validarSyllabus }
