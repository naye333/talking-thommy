import { html, renderizar } from '../../../nucleo/dom.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { estadoVacio } from '../../../componentes/estados.js'
import { botonPrincipal } from '../../../componentes/elementos.js'

export function pantallaNoEncontrada ({ contenedor }) {
  renderizar(contenedor, plantillaPantalla({
    clase: 'pantalla--sin-navegacion',
    cabecera: encabezado({ titulo: 'Página no encontrada', rutaAtras: '/' }),
    contenido: html`
      ${estadoVacio({ titulo: 'Esta página no existe', texto: 'Revisa el enlace o vuelve al inicio.' })}
      ${botonPrincipal({ texto: 'Ir al inicio', href: '/' })}`
  }))
}
