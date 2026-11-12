// Tarjetas reutilizables: accesos rápidos, filas de persona, enlaces de lista, listas con iconos.
import { html } from '../nucleo/dom.js'
import { icono } from './iconos.js'
import { avatar } from './elementos.js'

// Acceso rápido cuadrado (Mis Estudiantes, Reportes, Alertas, Configuración)
export function tarjetaAcceso ({ etiqueta, iconoNombre, ruta, destacada = false }) {
  return html`
    <a class="tarjeta-acceso${destacada ? ' tarjeta-acceso--destacada' : ''}" href="#${ruta}">
      ${icono(iconoNombre, { clase: 'tarjeta-acceso__icono' })}
      <span class="tarjeta-acceso__etiqueta">${etiqueta}</span>
    </a>`
}

// Fila con avatar, nombre y subtítulo (lista de estudiantes)
export function filaPersona ({ nombre, subtitulo, ruta, seleccionada = false, complemento = '' }) {
  return html`
    <a class="fila-persona${seleccionada ? ' fila-persona--seleccionada' : ''}" href="#${ruta}"
       ${seleccionada ? html`aria-current="true"` : ''}>
      ${avatar({ nombre })}
      <span class="fila-persona__textos">
        <span class="fila-persona__nombre">${nombre}</span>
        <span class="fila-persona__subtitulo">${subtitulo}</span>
      </span>
      ${complemento}
      ${icono('chevronDerecha', { clase: 'fila-persona__flecha' })}
    </a>`
}

// Enlace a otra sección dentro de una pantalla (por ejemplo, del reporte a sus falencias)
export function enlaceSeccion ({ titulo, descripcion, iconoNombre, ruta }) {
  return html`
    <a class="enlace-seccion" href="#${ruta}">
      ${icono(iconoNombre, { clase: 'enlace-seccion__icono' })}
      <span class="enlace-seccion__textos">
        <span class="enlace-seccion__titulo">${titulo}</span>
        ${descripcion ? html`<span class="enlace-seccion__descripcion">${descripcion}</span>` : ''}
      </span>
      ${icono('chevronDerecha', { clase: 'enlace-seccion__flecha' })}
    </a>`
}

// Tarjeta con título e icono y una lista de puntos con su propio icono (Fortalezas, Áreas a mejorar)
export function tarjetaLista ({ titulo, iconoTitulo, iconoElemento, elementos, textoVacio }) {
  return html`
    <section class="tarjeta tarjeta-lista">
      <h2 class="tarjeta-lista__titulo">${icono(iconoTitulo, { clase: 'tarjeta-lista__icono-titulo' })}${titulo}</h2>
      ${elementos.length === 0
        ? html`<p class="tarjeta-lista__vacio">${textoVacio}</p>`
        : html`<ul class="tarjeta-lista__elementos">
            ${elementos.map((texto) => html`
              <li class="tarjeta-lista__elemento">${icono(iconoElemento, { clase: 'tarjeta-lista__icono' })}<span>- ${texto}</span></li>`)}
          </ul>`}
    </section>`
}
