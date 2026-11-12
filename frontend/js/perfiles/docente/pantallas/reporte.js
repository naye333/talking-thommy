// Reporte del estudiante: promedio general, variación y desempeño por áreas en el periodo elegido.
import { html, renderizar } from '../../../nucleo/dom.js'
import { reemplazarQuery } from '../../../nucleo/enrutador.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { avatar, selectorPildora, avisoDatosEjemplo } from '../../../componentes/elementos.js'
import { enlaceSeccion } from '../../../componentes/tarjetas.js'
import { anilloProgreso, barraProgreso } from '../../../componentes/graficos.js'
import { cargarRegion } from '../../../componentes/estados.js'
import { icono } from '../../../componentes/iconos.js'
import { PERIODOS, obtenerPeriodo } from '../../../servicios/docente/servicioDocente.js'
import { navegacionDocente, RUTAS_DOCENTE } from '../navegacion.js'
import { seleccionEstudiante } from '../estado.js'
import { textoNivel, formatearVariacion } from '../presentacion.js'

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

function tarjetaPromedio ({ promedioGeneral, variacion, periodo }) {
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
          ${icono('tendencia', { clase: 'promedio__tendencia' })}
          <strong class="promedio__cambio">${formatearVariacion(variacion)}</strong>
          <span class="promedio__comparacion">${obtenerPeriodo(periodo).comparacion}</span>
        </div>
      </div>
    </section>`
}

function tarjetaArea (area) {
  return html`
    <article class="tarjeta tarjeta-area">
      <h3 class="tarjeta-area__nombre">${area.nombre}</h3>
      <strong class="tarjeta-area__valor">${area.valor}%</strong>
      ${barraProgreso({ valor: area.valor, etiqueta: area.nombre })}
    </article>`
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
      ${tarjetaPromedio(reporte)}

      <h2 class="titulo-seccion">${icono('barras', { clase: 'titulo-seccion__icono' })}Desempeño por áreas</h2>
      <div class="cuadricula-areas">${reporte.areas.map(tarjetaArea)}</div>

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
