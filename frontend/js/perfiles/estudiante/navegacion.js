// Navegación del perfil estudiante. El botón central "Hablar" deja la conversación con Thommy siempre a un toque.
import { barraNavegacion } from '../../componentes/estructura.js'

export const RUTAS_ESTUDIANTE = {
  inicio: '/estudiante',
  conversacion: '/estudiante/conversacion',
  lecciones: '/estudiante/lecciones',
  progreso: '/estudiante/progreso',
  perfil: '/estudiante/perfil',
  tema: (id) => `/estudiante/lecciones/temas/${id}`,
  practicarTema: (id) => `/estudiante/conversacion?tema=${id}`
}

const ELEMENTOS_BARRA = [
  { id: 'inicio', etiqueta: 'Inicio', icono: 'casa', ruta: RUTAS_ESTUDIANTE.inicio },
  { id: 'lecciones', etiqueta: 'Lecciones', icono: 'libroAbierto', ruta: RUTAS_ESTUDIANTE.lecciones },
  { id: 'hablar', etiqueta: 'Hablar', icono: 'microfono', ruta: RUTAS_ESTUDIANTE.conversacion, destacado: true },
  { id: 'progreso', etiqueta: 'Progreso', icono: 'barrasTrazo', ruta: RUTAS_ESTUDIANTE.progreso },
  { id: 'perfil', etiqueta: 'Perfil', icono: 'persona', ruta: RUTAS_ESTUDIANTE.perfil }
]

export const ELEMENTOS_MENU_ESTUDIANTE = [
  { etiqueta: 'Inicio', icono: 'casa', ruta: RUTAS_ESTUDIANTE.inicio },
  { etiqueta: 'Hablar con Thommy', icono: 'microfono', ruta: RUTAS_ESTUDIANTE.conversacion },
  { etiqueta: 'Lecciones', icono: 'libroAbierto', ruta: RUTAS_ESTUDIANTE.lecciones },
  { etiqueta: 'Mi progreso', icono: 'barrasTrazo', ruta: RUTAS_ESTUDIANTE.progreso },
  { etiqueta: 'Perfil', icono: 'persona', ruta: RUTAS_ESTUDIANTE.perfil }
]

export function navegacionEstudiante (activo) {
  return barraNavegacion({ elementos: ELEMENTOS_BARRA, activo })
}
