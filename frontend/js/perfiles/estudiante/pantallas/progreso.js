// Progreso del estudiante: reutiliza las tarjetas de reporte del perfil docente.
import { html, renderizar } from '../../../nucleo/dom.js'
import { reemplazarQuery } from '../../../nucleo/enrutador.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { selectorPildora, avisoDatosEjemplo, botonPrincipal } from '../../../componentes/elementos.js'
import { tarjetaLista } from '../../../componentes/tarjetas.js'
import { graficoLinea } from '../../../componentes/graficos.js'
import { tarjetaPromedio, cuadriculaAreas } from '../../../componentes/reportes.js'
import { cargarRegion } from '../../../componentes/estados.js'
import { icono } from '../../../componentes/iconos.js'
import { PERIODOS, obtenerPeriodo } from '../../../servicios/docente/servicioDocente.js'
import { navegacionEstudiante, RUTAS_ESTUDIANTE } from '../navegacion.js'

export function pantallaProgreso ({ contenedor, query, ruta }, app) {
  const servicio = app.servicios.progreso
  let periodo = obtenerPeriodo(query.periodo)

  renderizar(contenedor, plantillaPantalla({
    cabecera: encabezado({ titulo: 'Mi progreso', rutaAtras: RUTAS_ESTUDIANTE.inicio }),
    contenido: html`<div class="reporte" data-region="progreso"></div>`,
    navegacion: navegacionEstudiante('progreso')
  }))
  const region = contenedor.querySelector('[data-region="progreso"]')

  function cargar () {
    return cargarRegion(region, {
      cargar: () => servicio.obtenerProgreso({ periodo: periodo.valor }),
      textoCargando: 'Cargando tu progreso…',
      mostrar: (progreso) => html`
        <div class="progreso__periodo">
          ${selectorPildora({ id: 'periodo-progreso', etiqueta: 'Periodo', opciones: PERIODOS, valor: periodo.valor })}
        </div>
        ${tarjetaPromedio({ ...progreso, comparacion: periodo.comparacion })}
        ${cuadriculaAreas(progreso.areas)}
        <section class="tarjeta evolucion">
          <h2 class="evolucion__titulo">${icono('barras', { clase: 'evolucion__icono' })}Evolución de tu progreso</h2>
          ${graficoLinea({ puntos: progreso.evolucion, descripcion: `Tu evolución: de ${progreso.evolucion[0]?.valor}% a ${progreso.evolucion.at(-1)?.valor}%` })}
        </section>
        ${tarjetaLista({ titulo: 'Fortalezas', iconoTitulo: 'estrella', iconoElemento: 'exito', elementos: progreso.fortalezas, textoVacio: 'Sigue practicando para descubrirlas.' })}
        ${tarjetaLista({ titulo: 'Áreas a mejorar', iconoTitulo: 'alertaRoja', iconoElemento: 'exclamacion', elementos: progreso.areasMejorar, textoVacio: '¡Vas muy bien!' })}
        ${botonPrincipal({ texto: 'Practicar con Thommy', iconoInicio: 'microfono', href: RUTAS_ESTUDIANTE.conversacion })}
        ${avisoDatosEjemplo({ visible: servicio.capacidades.datosEjemplo })}`,
      alMostrar: () => {
        region.querySelector('#periodo-progreso').addEventListener('change', (evento) => {
          periodo = obtenerPeriodo(evento.target.value)
          reemplazarQuery(ruta, { periodo: periodo.valor })
          cargar()
        })
      }
    })
  }

  cargar()
}
