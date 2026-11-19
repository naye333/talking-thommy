// Estructura común de las pantallas: encabezado, contenido desplazable, barra inferior y decoración.
// La usan todos los perfiles; cada perfil solo define sus elementos de navegación.
import { html } from '../nucleo/dom.js'
import { icono } from './iconos.js'

// rutaAtras: a dónde volver si la pantalla se abrió directamente por URL
// complemento: acción opcional a la derecha (por ejemplo, un botón)
export function encabezado ({ titulo, rutaAtras = null, complemento = '' }) {
  return html`
    <header class="encabezado">
      ${rutaAtras
        ? html`<button class="encabezado__atras" type="button" data-accion="atras" data-ruta-atras="${rutaAtras}" aria-label="Volver">${icono('chevronIzquierda')}</button>`
        : ''}
      <h1 class="encabezado__titulo">${titulo}</h1>
      ${complemento ? html`<div class="encabezado__complemento">${complemento}</div>` : ''}
    </header>`
}

// elementos: [{ id, etiqueta, icono, ruta, destacado? }]. "destacado" lo muestra como botón central elevado.
export function barraNavegacion ({ elementos, activo }) {
  return html`
    <nav class="barra-navegacion" aria-label="Navegación principal" style="grid-template-columns: repeat(${elementos.length}, 1fr)">
      ${elementos.map((elemento) => {
        const esActivo = elemento.id === activo
        const clases = `barra-navegacion__elemento${esActivo ? ' barra-navegacion__elemento--activo' : ''}${elemento.destacado ? ' barra-navegacion__elemento--destacado' : ''}`
        return html`
          <a class="${clases}"
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
      <path d="M-20 220C-12 168 22 136 70 124c-14 28-18 60-8 96z" fill="var(--color-hoja)"/>
      <path d="M-30 176c22-36 58-50 94-48-28 16-46 42-52 76z" fill="var(--color-hoja-clara)" opacity=".5"/>
      <path d="M410 220c-8-56-42-90-90-100 16 30 20 66 12 100z" fill="var(--color-hoja)"/>
      <path d="M420 170c-22-32-56-44-90-40 26 14 42 38 48 70z" fill="var(--color-hoja-clara)" opacity=".45"/>
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
