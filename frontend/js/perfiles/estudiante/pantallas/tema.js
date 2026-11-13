// Detalle de un tema del syllabus (GET /api/syllabus/temas/:id) con acceso directo a practicarlo con Thommy.
import { html, renderizar } from '../../../nucleo/dom.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { botonPrincipal } from '../../../componentes/elementos.js'
import { cargarRegion } from '../../../componentes/estados.js'
import { icono } from '../../../componentes/iconos.js'
import { hablar, vozDisponible } from '../../../servicios/estudiante/voz.js'
import { navegacionEstudiante, RUTAS_ESTUDIANTE } from '../navegacion.js'

function etiquetas (titulo, valores) {
  if (!valores?.length) return ''
  return html`
    <section class="tarjeta tema__seccion">
      <h2 class="tema__subtitulo">${titulo}</h2>
      <p class="etiquetas" lang="en">${valores.map((valor) => html`<span class="etiquetas__etiqueta">${valor}</span>`)}</p>
    </section>`
}

export function pantallaTema ({ contenedor, params }, app) {
  renderizar(contenedor, plantillaPantalla({
    cabecera: encabezado({ titulo: 'Tema', rutaAtras: RUTAS_ESTUDIANTE.lecciones }),
    contenido: html`<div class="tema" data-region="tema"></div>`,
    navegacion: navegacionEstudiante('lecciones')
  }))

  const region = contenedor.querySelector('[data-region="tema"]')
  cargarRegion(region, {
    cargar: () => app.servicios.syllabus.consultarTema(params.id),
    textoCargando: 'Cargando tema…',
    mostrar: (tema) => html`
      <header class="tema__cabecera">
        <p class="tema__unidad">${tema.unidadTitulo}${tema.semana ? ` · Semana ${tema.semana}` : ''}</p>
        <h1 class="tema__titulo" lang="en">${tema.titulo}</h1>
        <p class="tema__objetivo">${tema.objetivo}</p>
      </header>

      ${botonPrincipal({ texto: 'Practicar con Thommy', iconoInicio: 'microfono', href: RUTAS_ESTUDIANTE.practicarTema(tema.id) })}

      <section class="tarjeta tema__seccion">
        <h2 class="tema__subtitulo">Frases para practicar</h2>
        <ul class="tema__frases">
          ${tema.frasesModelo.map((frase) => html`
            <li class="tema__frase">
              <span lang="en">${frase}</span>
              ${vozDisponible()
                ? html`<button class="mensaje__escuchar" type="button" data-accion="escuchar" data-texto="${frase}" aria-label="Escuchar: ${frase}">${icono('volumen')}</button>`
                : ''}
            </li>`)}
        </ul>
      </section>
      ${etiquetas('Vocabulario', tema.vocabulario)}
      ${etiquetas('Gramática', tema.gramatica)}`,
    alMostrar: () => {
      region.addEventListener('click', (evento) => {
        const boton = evento.target.closest('[data-accion="escuchar"]')
        if (boton) hablar(boton.dataset.texto)
      })
    }
  })
}
