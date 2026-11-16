// TUTOR DE EJEMPLO. Simula al tutor de IA mientras el backend no transcribe ni evalúa la pronunciación.
// No escucha el audio: supone que el estudiante dijo la frase que Thommy le pidió y alterna
// resultados "excelente" y "practicar" para mostrar ambas pantallas. Reemplazar por el backend real.

const FRASES_LIBRES = [
  'Hello, my name is Thommy.',
  'I am a student.',
  'I live in Villavicencio.',
  'I like to practice English.'
]

const ELOGIOS = ['Great job!', 'Well done!', 'Excellent!', 'Nice work!']

function palabrasDe (frase) {
  return frase.split(/\s+/).filter(Boolean)
}

// La palabra más larga suele ser la más difícil de pronunciar
function palabraDificil (frase) {
  return palabrasDe(frase)
    .map((palabra) => palabra.replace(/[^A-Za-z']/g, ''))
    .reduce((mayor, palabra) => (palabra.length > mayor.length ? palabra : mayor), '')
}

export function crearTutorEjemplo (tema = null) {
  const frases = tema?.frasesModelo?.length ? tema.frasesModelo : FRASES_LIBRES
  let turno = 0

  const fraseActual = () => frases[turno % frases.length]

  return {
    saludo () {
      const intro = tema ? `Today we will practice "${tema.titulo}".` : 'Let\'s have a short conversation.'
      return { texto: `Hi! I'm Thommy. ${intro} Try saying this:`, frase: fraseActual() }
    },

    responder () {
      const dicha = fraseActual()
      const esExcelente = turno % 2 === 0
      const dificil = palabraDificil(dicha)
      const palabras = palabrasDe(dicha).map((texto) => {
        const limpia = texto.replace(/[^A-Za-z']/g, '')
        const correcta = esExcelente || limpia !== dificil
        return correcta ? { texto, correcta } : { texto, correcta, sugerencia: `Repite despacio: "${limpia}"` }
      })
      turno += 1
      return {
        transcripcion: dicha,
        evaluacion: esExcelente
          ? { puntaje: 92, nivel: 'excelente', mensaje: 'Tu pronunciación es correcta.', palabras }
          : { puntaje: 68, nivel: 'practicar', mensaje: `Casi perfecto. Practica la palabra "${dificil}".`, palabras },
        respuesta: {
          texto: `${ELOGIOS[turno % ELOGIOS.length]} Now try this one:`,
          frase: fraseActual()
        }
      }
    }
  }
}
