// Falencias del estudiante: áreas que necesita reforzar, de la más baja a la más alta.
import { html, renderizar } from '../../../nucleo/dom.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { botonPrincipal, avisoDatosEjemplo } from '../../../componentes/elementos.js'
import { cargarRegion, estadoVacio } from '../../../componentes/estados.js'
import { icono } from '../../../componentes/iconos.js'
import { navegacionDocente, RUTAS_DOCENTE } from '../navegacion.js'
import { seleccionEstudiante } from '../estado.js'
import { ICONO_POR_AREA } from '../presentacion.js'

function tarjetaFalencia (falencia) {
  return html`
    <article class="tarjeta falencia">
      ${icono(ICONO_POR_AREA[falencia.clave] || 'exclamacion', { clase: 'falencia__icono' })}
      <div class="falencia__textos">
        <div class="falencia__cabecera">
          <h3 class="falencia__area">${falencia.area}</h3>
          <strong class="falencia__porcentaje">${falencia.porcentaje}%</strong>
        </div>
        <p class="falencia__descripcion">${falencia.descripcion}</p>
        <p class="falencia__tema">Tema: ${falencia.tema}</p>
      </div>
    </article>`
}

export function pantallaFalencias ({ contenedor, params }, app) {
  const servicio = app.servicios.docente
  const estudianteId = Number(params.id)
  seleccionEstudiante.guardar(estudianteId)

  renderizar(contenedor, plantillaPantalla({
    cabecera: encabezado({ titulo: 'Falencias del Estudiante', rutaAtras: RUTAS_DOCENTE.reporte(estudianteId) }),
    contenido: html`<div class="falencias" data-region="falencias"></div>`,
    navegacion: navegacionDocente()
  }))

  cargarRegion(contenedor.querySelector('[data-region="falencias"]'), {
    cargar: () => servicio.obtenerFalencias(estudianteId),
    textoCargando: 'Cargando falencias…',
    mostrar: ({ estudiante, falencias }) => html`
      <section class="tarjeta aviso-refuerzo">
        ${icono('alertaAmarilla', { clase: 'aviso-refuerzo__icono' })}
        <div>
          <h2 class="aviso-refuerzo__titulo">Áreas que necesita reforzar</h2>
          <p class="aviso-refuerzo__texto">${estudiante.nombre} · basado en su rendimiento reciente</p>
        </div>
      </section>
      ${falencias.length === 0
        ? estadoVacio({ titulo: 'Sin falencias registradas', texto: 'Este estudiante no tiene áreas por reforzar.' })
        : falencias.map(tarjetaFalencia)}
      ${botonPrincipal({ texto: 'Recomendaciones', iconoInicio: 'bombilla', conFlecha: true, href: RUTAS_DOCENTE.acciones(estudianteId), clase: 'falencias__boton' })}
      ${avisoDatosEjemplo({ visible: servicio.capacidades.datosEjemplo })}`
  })
}
