// DATOS DE EJEMPLO del perfil docente.
// El backend aún no tiene sesiones de práctica ni reportes; estos datos solo sirven para construir y
// probar la interfaz. Los temas de las falencias salen del syllabus real de Inglés I
// (backend/src/bd/semillas/syllabus-ingles-1.json). Los estudiantes y porcentajes son ficticios.

export const AREAS = [
  { clave: 'pronunciacion', nombre: 'Pronunciación' },
  { clave: 'vocabulario', nombre: 'Vocabulario' },
  { clave: 'gramatica', nombre: 'Gramática' },
  { clave: 'fluidez', nombre: 'Fluidez' }
]

// Una falencia típica por área, ligada a un tema del syllabus de Inglés I
export const FALENCIAS_POR_AREA = {
  gramatica: {
    tema: 'Giving and asking for personal information',
    descripcion: 'Presenta dificultades al usar "be" en preguntas y respuestas cortas.',
    recomendacion: 'Practicar preguntas y respuestas cortas con "be"'
  },
  vocabulario: {
    tema: 'Professions and their duties',
    descripcion: 'Confunde el vocabulario de profesiones y sus funciones.',
    recomendacion: 'Repasar el vocabulario de profesiones'
  },
  fluidez: {
    tema: 'Introducing yourself',
    descripcion: 'Hace pausas largas al presentarse y presentar a otros.',
    recomendacion: 'Practicar presentaciones personales en voz alta'
  },
  pronunciacion: {
    tema: 'The alphabet and spelling',
    descripcion: 'Tiene dificultad al deletrear y pronunciar algunas letras.',
    recomendacion: 'Repetir con Thommy las frases modelo del tema'
  }
}

// areas: [pronunciación, vocabulario, gramática, fluidez] del último mes
// evolucionMes: 7 mediciones del último mes; la última coincide con el promedio general
export const ESTUDIANTES = [
  { id: 1, nombre: 'Valentina Torres', nivel: 1, areas: [82, 78, 74, 80], variacionMes: 3, practicaConstante: true, falencias: { gramatica: 62, fluidez: 70, vocabulario: 72 }, evolucionMes: [66, 70, 72, 75, 76, 77, 79] },
  { id: 2, nombre: 'Juan Pérez', nivel: 1, areas: [64, 60, 58, 66], variacionMes: -2, practicaConstante: false, falencias: { gramatica: 48, vocabulario: 52, pronunciacion: 58 }, evolucionMes: [66, 65, 63, 64, 62, 63, 62] },
  { id: 3, nombre: 'Sofía Ramírez', nivel: 1, areas: [85, 70, 75, 80], variacionMes: 5, practicaConstante: true, falencias: { gramatica: 60, vocabulario: 65, fluidez: 68 }, evolucionMes: [52, 62, 66, 74, 77, 74, 78] },
  { id: 4, nombre: 'Mateo Gómez', nivel: 1, areas: [72, 80, 77, 69], variacionMes: 4, practicaConstante: true, falencias: { fluidez: 58, pronunciacion: 63, gramatica: 69 }, evolucionMes: [62, 65, 68, 70, 72, 73, 75] },
  { id: 5, nombre: 'Daniela Castro', nivel: 1, areas: [90, 86, 84, 88], variacionMes: 2, practicaConstante: true, falencias: { gramatica: 76, vocabulario: 79, fluidez: 81 }, evolucionMes: [80, 82, 83, 85, 84, 86, 87] },
  { id: 6, nombre: 'Samuel Rojas', nivel: 1, areas: [58, 62, 55, 60], variacionMes: -4, practicaConstante: false, falencias: { gramatica: 45, pronunciacion: 50, fluidez: 52 }, evolucionMes: [65, 64, 62, 61, 60, 60, 59] },
  { id: 7, nombre: 'Isabella Moreno', nivel: 1, areas: [76, 72, 70, 74], variacionMes: 1, practicaConstante: false, falencias: { gramatica: 61, vocabulario: 64, fluidez: 66 }, evolucionMes: [70, 71, 70, 72, 72, 73, 73] }
]

// Cómo cambian los datos de ejemplo según el periodo consultado
export const AJUSTES_POR_PERIODO = {
  ultima_semana: {
    ajusteAreas: 1,
    variacion: () => 1,
    etiquetas: ['Lun', null, 'Mié', null, 'Vie', null, 'Dom'],
    desplazamientos: [-5, -3, -4, -1, -2, 1, 0]
  },
  ultimo_mes: {
    ajusteAreas: 0,
    variacion: (estudiante) => estudiante.variacionMes,
    etiquetas: ['Sem 1', null, 'Sem 2', null, 'Sem 3', null, 'Sem 4']
  },
  semestre: {
    ajusteAreas: -3,
    variacion: (estudiante) => (estudiante.variacionMes >= 0 ? 14 : -6),
    etiquetas: ['Corte 1', null, null, 'Corte 2', null, null, 'Corte 3'],
    desplazamientos: [-14, -11, -9, -6, -4, -2, 0]
  }
}
