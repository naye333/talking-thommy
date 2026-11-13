// Lecciones: unidades y temas del syllabus real (GET /api/syllabus) por curso.
import { html, renderizar } from '../../../nucleo/dom.js'
import { reemplazarQuery } from '../../../nucleo/enrutador.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { cargarRegion, estadoVacio } from '../../../componentes/estados.js'
import { icono } from '../../../componentes/iconos.js'
import { navegacionEstudiante, RUTAS_ESTUDIANTE } from '../navegacion.js'

const CURSOS = [{ nivel: 1, etiqueta: 'Inglés I' }, { nivel: 2, etiqueta: 'Inglés II' }]
const ICONOS_UNIDAD = ['chat', 'maletin', 'cubiertos', 'libroAbierto']

function tarjetaUnidad (unidad, indice) {
  return html`
    <details class="unidad" ${indice === 0 ? html`open` : ''}>
      <summary class="unidad__resumen">
        <span class="unidad__icono unidad__icono--${indice % ICONOS_UNIDAD.length}">${icono(ICONOS_UNIDAD[indice % ICONOS_UNIDAD.length])}</span>
        <span class="unidad__textos">
          <span class="unidad__numero">Unidad ${unidad.numero}</span>
          <span class="unidad__titulo">${unidad.titulo}</span>
        </span>
        ${icono('chevronDerecha', { clase: 'unidad__flecha' })}
      </summary>
      <ol class="unidad__temas">
        ${unidad.temas.map((tema) => html`
          <li>
            <a class="unidad__tema" href="#${RUTAS_ESTUDIANTE.tema(tema.id)}">
              <span class="unidad__semana">${tema.semana ? `Semana ${tema.semana}` : `Tema ${tema.numero}`}</span>
              <span>${tema.titulo}</span>
            </a>
          </li>`)}
      </ol>
    </details>`
}

export function pantallaLecciones ({ contenedor, query, ruta }, app) {
  const nivelUsuario = app.sesion.obtenerUsuario()?.nivel
  let nivel = [1, 2].includes(Number(query.nivel)) ? Number(query.nivel) : (nivelUsuario || 1)

  renderizar(contenedor, plantillaPantalla({
    cabecera: encabezado({ titulo: 'Lecciones', rutaAtras: RUTAS_ESTUDIANTE.inicio }),
    contenido: html`
      <div class="pestanas" role="tablist" aria-label="Curso">
        ${CURSOS.map((curso) => html`
          <button class="pestanas__pestana" type="button" role="tab" data-nivel="${curso.nivel}"
                  aria-selected="${String(curso.nivel === nivel)}">${curso.etiqueta}</button>`)}
      </div>
      <div class="lecciones" data-region="unidades" role="tabpanel"></div>`,
    navegacion: navegacionEstudiante('lecciones')
  }))

  const region = contenedor.querySelector('[data-region="unidades"]')

  function cargar () {
    for (const pestana of contenedor.querySelectorAll('[data-nivel]')) {
      pestana.setAttribute('aria-selected', String(Number(pestana.dataset.nivel) === nivel))
    }
    return cargarRegion(region, {
      cargar: () => app.servicios.syllabus.listar({ nivel }),
      textoCargando: 'Cargando lecciones…',
      mostrar: ({ unidades }) => unidades.length === 0
        ? estadoVacio({ titulo: 'Aún no hay lecciones para este curso', texto: 'Tu profesor las publicará pronto.' })
        : unidades.map(tarjetaUnidad)
    })
  }

  contenedor.querySelector('[role="tablist"]').addEventListener('click', (evento) => {
    const pestana = evento.target.closest('[data-nivel]')
    if (!pestana || Number(pestana.dataset.nivel) === nivel) return
    nivel = Number(pestana.dataset.nivel)
    reemplazarQuery(ruta, { nivel })
    cargar()
  })

  cargar()
}
