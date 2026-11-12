// Estructura común de las pantallas: encabezado, contenido desplazable, barra inferior y decoración.
// La usan todos los perfiles; cada perfil solo define sus elementos de navegación.
import { html } from '../nucleo/dom.js'
import { icono } from './iconos.js'

// rutaAtras: a dónde volver si la pantalla se abrió directamente por URL
export function encabezado ({ titulo, rutaAtras = null }) {
  return html`
    <header class="encabezado">
      ${rutaAtras
        ? html`<button class="encabezado__atras" type="button" data-accion="atras" data-ruta-atras="${rutaAtras}" aria-label="Volver">${icono('chevronIzquierda')}</button>`
        : ''}
      <h1 class="encabezado__titulo">${titulo}</h1>
    </header>`
}

// elementos: [{ id, etiqueta, icono, ruta }]
export function barraNavegacion ({ elementos, activo }) {
  return html`
    <nav class="barra-navegacion" aria-label="Navegación principal">
      ${elementos.map((elemento) => {
        const esActivo = elemento.id === activo
        return html`
          <a class="barra-navegacion__elemento${esActivo ? ' barra-navegacion__elemento--activo' : ''}"
             href="#${elemento.ruta}" ${esActivo ? html`aria-current="page"` : ''}>
            ${icono(elemento.icono, { clase: 'barra-navegacion__icono' })}
            <span>${elemento.etiqueta}</span>
          </a>`
      })}
    </nav>`
}

// Hojas oscuras del fondo, como en el diseño
function decoracionHojas () {
  return html`
    <svg class="decoracion-hojas" viewBox="0 0 390 220" preserveAspectRatio="none" aria-hidden="true">
      <path d="M-20 220C-8 150 40 112 96 104c-20 30-26 66-12 116z" fill="var(--color-hoja)"/>
      <path d="M-30 160c30-46 78-62 124-56-36 18-62 50-70 96z" fill="var(--color-hoja-clara)" opacity=".55"/>
      <path d="M410 220c-10-74-58-118-120-126 22 34 30 78 18 126z" fill="var(--color-hoja)"/>
      <path d="M420 150c-28-40-74-54-118-46 34 16 58 46 66 86z" fill="var(--color-hoja-clara)" opacity=".5"/>
    </svg>`
}

export function plantillaPantalla ({ cabecera = '', contenido, navegacion = '', clase = '' }) {
  return html`
    <div class="pantalla ${clase}">
      ${decoracionHojas()}
      ${cabecera}
      <main class="pantalla__contenido">${contenido}</main>
      ${navegacion}
    </div>`
}
