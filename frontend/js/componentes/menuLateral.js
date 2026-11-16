// Menú lateral que se abre con el botón de hamburguesa. Reutilizable por cualquier perfil.
import { html } from '../nucleo/dom.js'
import { icono } from './iconos.js'

// elementos: [{ etiqueta, icono, ruta }]
export function menuLateral ({ titulo, subtitulo, elementos }) {
  return html`
    <div class="menu-lateral" data-menu-lateral hidden>
      <div class="menu-lateral__fondo" data-accion="cerrar-menu"></div>
      <aside class="menu-lateral__panel" role="dialog" aria-modal="true" aria-label="Menú">
        <div class="menu-lateral__cabecera">
          <div>
            <p class="menu-lateral__titulo">${titulo}</p>
            ${subtitulo ? html`<p class="menu-lateral__subtitulo">${subtitulo}</p>` : ''}
          </div>
          <button class="boton-icono" type="button" data-accion="cerrar-menu" aria-label="Cerrar menú">${icono('cerrar')}</button>
        </div>
        <nav class="menu-lateral__enlaces">
          ${elementos.map((elemento) => html`
            <a class="menu-lateral__enlace" href="#${elemento.ruta}" data-accion="cerrar-menu">
              ${icono(elemento.icono)}<span>${elemento.etiqueta}</span>
            </a>`)}
        </nav>
        <button class="menu-lateral__salir" type="button" data-accion="cerrar-sesion">
          ${icono('salir')}<span>Cerrar sesión</span>
        </button>
      </aside>
    </div>`
}

// Conecta apertura y cierre. Devuelve una función para limpiar los eventos globales.
export function conectarMenuLateral (contenedor) {
  const menu = contenedor.querySelector('[data-menu-lateral]')
  if (!menu) return () => {}
  let elementoAnterior = null

  function abrir () {
    elementoAnterior = contenedor.ownerDocument.activeElement
    menu.hidden = false
    requestAnimationFrame(() => menu.classList.add('menu-lateral--abierto'))
    menu.querySelector('.menu-lateral__panel [data-accion="cerrar-menu"]').focus()
  }

  function cerrar () {
    menu.classList.remove('menu-lateral--abierto')
    menu.hidden = true
    if (elementoAnterior && elementoAnterior.isConnected) elementoAnterior.focus()
  }

  function alHacerClic (evento) {
    if (evento.target.closest('[data-accion="abrir-menu"]')) abrir()
    else if (evento.target.closest('[data-accion="cerrar-menu"]') && !menu.hidden) cerrar()
  }

  function alPresionarTecla (evento) {
    if (evento.key === 'Escape' && !menu.hidden) cerrar()
  }

  contenedor.addEventListener('click', alHacerClic)
  contenedor.ownerDocument.addEventListener('keydown', alPresionarTecla)
  return () => contenedor.ownerDocument.removeEventListener('keydown', alPresionarTecla)
}
