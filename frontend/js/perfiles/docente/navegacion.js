// Navegación del perfil docente: barra inferior y menú lateral.
import { barraNavegacion } from '../../componentes/estructura.js'

export const RUTAS_DOCENTE = {
  inicio: '/docente',
  estudiantes: '/docente/estudiantes',
  reportes: '/docente/reportes',
  alertas: '/docente/alertas',
  configuracion: '/docente/configuracion',
  reporte: (id) => `/docente/estudiantes/${id}/reporte`,
  falencias: (id) => `/docente/estudiantes/${id}/falencias`,
  detalle: (id) => `/docente/estudiantes/${id}/detalle`,
  acciones: (id) => `/docente/estudiantes/${id}/acciones`
}

// "Home" lleva al inicio según el rol; "Docente" identifica el perfil activo (siempre resaltado, como en el diseño)
const ELEMENTOS_BARRA = [
  { id: 'home', etiqueta: 'Home', icono: 'casa', ruta: '/' },
  { id: 'estudiantes', etiqueta: 'Estudiantes', icono: 'estudiantesTrazo', ruta: RUTAS_DOCENTE.estudiantes },
  { id: 'reportes', etiqueta: 'Reportes', icono: 'barrasTrazo', ruta: RUTAS_DOCENTE.reportes },
  { id: 'docente', etiqueta: 'Docente', icono: 'birrete', ruta: RUTAS_DOCENTE.inicio }
]

export const ELEMENTOS_MENU_DOCENTE = [
  { etiqueta: 'Inicio', icono: 'casa', ruta: RUTAS_DOCENTE.inicio },
  { etiqueta: 'Mis estudiantes', icono: 'estudiantesTrazo', ruta: RUTAS_DOCENTE.estudiantes },
  { etiqueta: 'Reportes', icono: 'barrasTrazo', ruta: RUTAS_DOCENTE.reportes },
  { etiqueta: 'Alertas', icono: 'campana', ruta: RUTAS_DOCENTE.alertas },
  { etiqueta: 'Configuración', icono: 'engranajeTrazo', ruta: RUTAS_DOCENTE.configuracion }
]

export function navegacionDocente () {
  return barraNavegacion({ elementos: ELEMENTOS_BARRA, activo: 'docente' })
}
