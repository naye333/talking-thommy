// Utilidades para construir HTML de forma segura con plantillas de texto.
// Todo valor interpolado con html`` se escapa, salvo que ya sea HTML seguro (crudo).

const MARCA_SEGURO = Symbol('htmlSeguro')

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escaparHtml (valor) {
  return String(valor).replace(/[&<>"']/g, (caracter) => ENTIDADES[caracter])
}

// Marca un texto como HTML seguro (solo para contenido generado por la propia app, como iconos)
export function crudo (texto) {
  return { [MARCA_SEGURO]: true, texto: String(texto) }
}

function convertirValor (valor) {
  if (valor === null || valor === undefined || valor === false) return ''
  if (Array.isArray(valor)) return valor.map(convertirValor).join('')
  if (valor[MARCA_SEGURO]) return valor.texto
  return escaparHtml(valor)
}

export function html (partes, ...valores) {
  let resultado = ''
  partes.forEach((parte, indice) => {
    resultado += parte
    if (indice < valores.length) resultado += convertirValor(valores[indice])
  })
  return crudo(resultado)
}

export function renderizar (contenedor, plantilla) {
  contenedor.innerHTML = convertirValor(plantilla)
}

// Quita tildes y pasa a minúsculas para comparar textos (búsquedas)
export function normalizarTexto (texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
