import { describir, afirmar } from '../marco.js'
import { html, crudo, escaparHtml, normalizarTexto } from '../../js/nucleo/dom.js'

describir('dom', (prueba) => {
  prueba('escapa los valores interpolados', () => {
    const resultado = html`<p>${'<script>alert(1)</script>'}</p>`
    afirmar.igual(resultado.texto, '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })

  prueba('no escapa HTML marcado como seguro ni plantillas anidadas', () => {
    const icono = crudo('<svg></svg>')
    const resultado = html`<div>${icono}${html`<b>${'a&b'}</b>`}</div>`
    afirmar.igual(resultado.texto, '<div><svg></svg><b>a&amp;b</b></div>')
  })

  prueba('une listas e ignora null, undefined y false', () => {
    const resultado = html`<ul>${['x', 'y'].map((letra) => html`<li>${letra}</li>`)}${null}${false}</ul>`
    afirmar.igual(resultado.texto, '<ul><li>x</li><li>y</li></ul>')
  })

  prueba('escapa comillas', () => {
    afirmar.igual(escaparHtml(`"'`), '&quot;&#39;')
  })

  prueba('normaliza tildes y mayúsculas', () => {
    afirmar.igual(normalizarTexto('  Sofía RAMÍREZ '), 'sofia ramirez')
  })
})
