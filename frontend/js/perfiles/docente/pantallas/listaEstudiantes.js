// Lista de estudiantes del docente. Se reutiliza para "Mis Estudiantes", "Reportes" y "Alertas".
import { html, renderizar } from '../../../nucleo/dom.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { buscador, avisoDatosEjemplo } from '../../../componentes/elementos.js'
import { filaPersona } from '../../../componentes/tarjetas.js'
import { cargarRegion, estadoVacio } from '../../../componentes/estados.js'
import { icono } from '../../../componentes/iconos.js'
import { navegacionDocente, RUTAS_DOCENTE } from '../navegacion.js'
import { seleccionEstudiante } from '../estado.js'
import { textoNivel } from '../presentacion.js'

const ESPERA_BUSQUEDA_MS = 200

const MODOS = {
  estudiantes: {
    titulo: 'Mis Estudiantes',
    conBuscador: true,
    cargar: (servicio, busqueda) => servicio.listarEstudiantes({ busqueda }),
    subtitulo: (estudiante) => textoNivel(estudiante.nivel),
    complemento: () => '',
    vacio: { titulo: 'No encontramos estudiantes', texto: 'Prueba con otro nombre.' }
  },
  reportes: {
    titulo: 'Reportes',
    conBuscador: true,
    cargar: (servicio, busqueda) => servicio.listarEstudiantes({ busqueda }),
    subtitulo: (estudiante) => textoNivel(estudiante.nivel),
    complemento: (estudiante) => html`<span class="insignia-promedio" aria-label="Promedio general">${estudiante.promedioGeneral}%</span>`,
    vacio: { titulo: 'No encontramos estudiantes', texto: 'Prueba con otro nombre.' }
  },
  alertas: {
    titulo: 'Alertas',
    conBuscador: false,
    descripcion: 'Estudiantes con promedio bajo o que bajaron su rendimiento este mes.',
    cargar: (servicio) => servicio.listarAlertas(),
    subtitulo: (estudiante) => estudiante.motivo,
    complemento: () => icono('exclamacion', { clase: 'fila-persona__alerta' }),
    vacio: { titulo: 'Sin alertas por ahora', texto: 'Todos tus estudiantes van bien.' }
  }
}

export function crearPantallaListaEstudiantes (modo) {
  const configuracion = MODOS[modo]

  return function pantallaListaEstudiantes ({ contenedor }, app) {
    const servicio = app.servicios.docente
    const idBuscador = `buscar-${modo}`

    renderizar(contenedor, plantillaPantalla({
      cabecera: encabezado({ titulo: configuracion.titulo, rutaAtras: RUTAS_DOCENTE.inicio }),
      contenido: html`
        ${configuracion.conBuscador ? buscador({ id: idBuscador, placeholder: 'Buscar estudiante...' }) : ''}
        ${configuracion.descripcion ? html`<p class="lista-estudiantes__descripcion">${configuracion.descripcion}</p>` : ''}
        <div class="lista-estudiantes" data-region="lista" aria-live="polite"></div>
        ${avisoDatosEjemplo({ visible: servicio.capacidades.datosEjemplo })}`,
      navegacion: navegacionDocente()
    }))

    const region = contenedor.querySelector('[data-region="lista"]')

    function mostrarLista (estudiantes) {
      if (estudiantes.length === 0) return estadoVacio(configuracion.vacio)
      const seleccionado = seleccionEstudiante.obtener()
      return estudiantes.map((estudiante) => filaPersona({
        nombre: estudiante.nombre,
        subtitulo: configuracion.subtitulo(estudiante),
        ruta: RUTAS_DOCENTE.reporte(estudiante.id),
        seleccionada: estudiante.id === seleccionado,
        complemento: configuracion.complemento(estudiante)
      }))
    }

    function cargar (busqueda = '') {
      return cargarRegion(region, {
        cargar: () => configuracion.cargar(servicio, busqueda),
        mostrar: mostrarLista,
        textoCargando: 'Cargando estudiantes…'
      })
    }

    cargar()

    if (!configuracion.conBuscador) return
    let temporizador = null
    contenedor.querySelector(`#${idBuscador}`).addEventListener('input', (evento) => {
      clearTimeout(temporizador)
      temporizador = setTimeout(() => cargar(evento.target.value), ESPERA_BUSQUEDA_MS)
    })
    return () => clearTimeout(temporizador)
  }
}
