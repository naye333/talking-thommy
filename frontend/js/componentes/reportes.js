// Tarjetas de reporte compartidas por el docente (reporte de un estudiante) y el estudiante (su progreso).
import { html } from '../nucleo/dom.js'
import { icono } from './iconos.js'
import { anilloProgreso, barraProgreso } from './graficos.js'

export function formatearVariacion (variacion) {
  const numero = Math.round(Number(variacion) || 0)
  return `${numero > 0 ? '+' : ''}${numero}%`
}

// comparacion: texto bajo la variación, por ejemplo "vs. mes anterior"
export function tarjetaPromedio ({ promedioGeneral, variacion, comparacion }) {
  const esBaja = variacion < 0
  return html`
    <section class="tarjeta promedio">
      <h2 class="promedio__titulo">Promedio General</h2>
      <div class="promedio__cuerpo">
        ${anilloProgreso({ valor: promedioGeneral, etiqueta: 'Promedio general' })}
        <div class="promedio__valor">
          <span class="promedio__etiqueta">Rendimiento</span>
          <strong class="promedio__porcentaje">${promedioGeneral}%</strong>
        </div>
        <div class="promedio__variacion${esBaja ? ' promedio__variacion--baja' : ''}">
          ${icono(esBaja ? 'tendenciaBaja' : 'tendencia', { clase: 'promedio__tendencia' })}
          <strong class="promedio__cambio">${formatearVariacion(variacion)}</strong>
          <span class="promedio__comparacion">${comparacion}</span>
        </div>
      </div>
    </section>`
}

export function cuadriculaAreas (areas) {
  return html`
    <h2 class="titulo-seccion">${icono('barras', { clase: 'titulo-seccion__icono' })}Desempeño por áreas</h2>
    <div class="cuadricula-areas">
      ${areas.map((area) => html`
        <article class="tarjeta tarjeta-area">
          <h3 class="tarjeta-area__nombre">${area.nombre}</h3>
          <strong class="tarjeta-area__valor">${area.valor}%</strong>
          ${barraProgreso({ valor: area.valor, etiqueta: area.nombre })}
        </article>`)}
    </div>`
}
