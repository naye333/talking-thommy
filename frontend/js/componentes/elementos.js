// Piezas básicas reutilizables: avatar, botones, buscador, mascota, aviso de datos de ejemplo.
import { html } from '../nucleo/dom.js'
import { icono } from './iconos.js'

const COLORES_AVATAR = ['#f6d7c3', '#d7e6f8', '#f8d6e3', '#dcefc9', '#eadcf8', '#f9e7b8']

export function obtenerIniciales (nombre) {
  const palabras = String(nombre || '').trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return '?'
  const primera = palabras[0][0]
  const ultima = palabras.length > 1 ? palabras[palabras.length - 1][0] : ''
  return (primera + ultima).toUpperCase()
}

function colorPorNombre (nombre) {
  let suma = 0
  for (const caracter of String(nombre)) suma = (suma + caracter.charCodeAt(0)) % 997
  return COLORES_AVATAR[suma % COLORES_AVATAR.length]
}

// tamano: 'md' (listas) o 'lg' (cabecera del reporte)
export function avatar ({ nombre, tamano = 'md' }) {
  return html`
    <span class="avatar avatar--${tamano}" style="--color-avatar: ${colorPorNombre(nombre)}" aria-hidden="true">
      ${obtenerIniciales(nombre)}
    </span>`
}

// Botón verde lima. Con href es un enlace; sin href es un botón con data-accion.
export function botonPrincipal ({ texto, iconoInicio, conFlecha = false, href, accion, deshabilitado = false, clase = '' }) {
  const contenido = html`
    ${iconoInicio ? icono(iconoInicio, { clase: 'boton-principal__icono' }) : ''}
    <span class="boton-principal__texto">${texto}</span>
    ${conFlecha ? icono('chevronDerecha', { clase: 'boton-principal__flecha' }) : ''}`

  if (href && !deshabilitado) {
    return html`<a class="boton-principal ${clase}" href="#${href}">${contenido}</a>`
  }
  return html`
    <button class="boton-principal ${clase}" type="button" ${accion ? html`data-accion="${accion}"` : ''}
            ${deshabilitado ? html`disabled aria-disabled="true"` : ''}>${contenido}</button>`
}

export function buscador ({ id, placeholder, valor = '' }) {
  return html`
    <label class="buscador" for="${id}">
      ${icono('buscar', { clase: 'buscador__icono' })}
      <span class="solo-lectores">${placeholder}</span>
      <input class="buscador__campo" id="${id}" type="search" placeholder="${placeholder}" value="${valor}" autocomplete="off">
    </label>`
}

// Selector en forma de píldora (por ejemplo, "Último mes"). opciones: [{ valor, etiqueta }]
export function selectorPildora ({ id, etiqueta, opciones, valor }) {
  return html`
    <label class="selector-pildora" for="${id}">
      <span class="solo-lectores">${etiqueta}</span>
      <select class="selector-pildora__campo" id="${id}">
        ${opciones.map((opcion) => html`
          <option value="${opcion.valor}" ${opcion.valor === valor ? html`selected` : ''}>${opcion.etiqueta}</option>`)}
      </select>
      ${icono('chevronAbajo', { clase: 'selector-pildora__icono' })}
    </label>`
}

// Ilustraciones de Thommy. variante: 'docente' (con portátil) o 'animo' (asomándose)
export function mascota ({ variante, clase = '' }) {
  return html`
    <img class="mascota mascota--${variante} ${clase}" src="assets/img/thommy-${variante}.png"
         alt="Thommy, la mascota de Talking Thommy" width="270" height="225" decoding="async">`
}

// Aviso discreto mientras el backend no tenga el servicio real
export function avisoDatosEjemplo ({ visible }) {
  if (!visible) return ''
  return html`<p class="aviso-ejemplo" role="note">Datos de ejemplo · el servidor aún no ofrece este servicio</p>`
}
