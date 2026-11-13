// Reporte del estudiante: promedio general, variación y desempeño por áreas en el periodo elegido.
import { html, renderizar } from '../../../nucleo/dom.js'
import { reemplazarQuery } from '../../../nucleo/enrutador.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { avatar, selectorPildora, avisoDatosEjemplo } from '../../../componentes/elementos.js'
import { enlaceSeccion } from '../../../componentes/tarjetas.js'
import { tarjetaPromedio, cuadriculaAreas } from '../../../componentes/reportes.js'
import { cargarRegion } from '../../../componentes/estados.js'
import { icono } from '../../../componentes/iconos.js'
import { PERIODOS, obtenerPeriodo } from '../../../servicios/docente/servicioDocente.js'
import { navegacionDocente, RUTAS_DOCENTE } from '../navegacion.js'
import { seleccionEstudiante } from '../estado.js'
import { textoNivel } from '../presentacion.js'

export function cabeceraEstudiante ({ estudiante, complemento = '' }) {
  return html`
    <section class="cabecera-estudiante">
      <div class="cabecera-estudiante__avatar">
        ${avatar({ nombre: estudiante.nombre, tamano: 'lg' })}
        ${icono('birrete', { clase: 'cabecera-estudiante__birrete' })}
      </div>
      <div class="cabecera-estudiante__textos">
        <h2 class="cabecera-estudiante__nombre">${estudiante.nombre}</h2>
        <p class="cabecera-estudiante__nivel">${textoNivel(estudiante.nivel)}</p>
      </div>
      ${complemento}
    </section>`
}

export function pantallaReporte ({ contenedor, params, query, ruta }, app) {
  const servicio = app.servicios.docente
  const estudianteId = Number(params.id)
  let periodo = obtenerPeriodo(query.periodo).valor
  seleccionEstudiante.guardar(estudianteId)

  renderizar(contenedor, plantillaPantalla({
    cabecera: encabezado({ titulo: 'Reporte del Estudiante', rutaAtras: RUTAS_DOCENTE.estudiantes }),
    contenido: html`<div class="reporte" data-region="reporte"></div>`,
    navegacion: navegacionDocente()
  }))
  const region = contenedor.querySelector('[data-region="reporte"]')

  function mostrar (reporte) {
    return html`
      ${cabeceraEstudiante({
        estudiante: reporte.estudiante,
        complemento: selectorPildora({ id: 'periodo-reporte', etiqueta: 'Periodo del reporte', opciones: PERIODOS, valor: reporte.periodo })
      })}
      ${tarjetaPromedio({ ...reporte, comparacion: obtenerPeriodo(reporte.periodo).comparacion })}

      ${cuadriculaAreas(reporte.areas)}

      <nav class="reporte__enlaces" aria-label="Más información del estudiante">
        ${enlaceSeccion({ titulo: 'Falencias del estudiante', descripcion: 'Áreas que necesita reforzar', iconoNombre: 'alertaAmarilla', ruta: RUTAS_DOCENTE.falencias(estudianteId) })}
        ${enlaceSeccion({ titulo: 'Detalle del reporte', descripcion: 'Evolución, fortalezas y áreas a mejorar', iconoNombre: 'tendencia', ruta: `${RUTAS_DOCENTE.detalle(estudianteId)}?periodo=${reporte.periodo}` })}
        ${enlaceSeccion({ titulo: 'Acciones', descripcion: 'Sugerencias para reforzar', iconoNombre: 'portapapeles', ruta: RUTAS_DOCENTE.acciones(estudianteId) })}
      </nav>
      ${avisoDatosEjemplo({ visible: servicio.capacidades.datosEjemplo })}`
  }

  function cargar () {
    return cargarRegion(region, {
      cargar: () => servicio.obtenerReporte(estudianteId, { periodo }),
      mostrar,
      textoCargando: 'Cargando reporte…',
      alMostrar: () => {
        region.querySelector('#periodo-reporte').addEventListener('change', (evento) => {
          periodo = evento.target.value
          reemplazarQuery(ruta, { periodo })
          cargar()
        })
      }
    })
  }

  cargar()
}
