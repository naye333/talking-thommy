import { describir, afirmar } from '../marco.js'
import { analizarHash, prepararRutas, resolverRuta } from '../../js/nucleo/enrutador.js'

describir('enrutador', (prueba) => {
  const rutas = prepararRutas([
    { patron: '/docente' },
    { patron: '/docente/estudiantes' },
    { patron: '/docente/estudiantes/:id/reporte' }
  ])

  prueba('separa la ruta y la query del hash', () => {
    afirmar.profundo(analizarHash('#/docente/estudiantes/3/reporte?periodo=semestre'), {
      ruta: '/docente/estudiantes/3/reporte',
      query: { periodo: 'semestre' }
    })
  })

  prueba('un hash vacío equivale a la raíz', () => {
    afirmar.profundo(analizarHash(''), { ruta: '/', query: {} })
    afirmar.profundo(analizarHash('#'), { ruta: '/', query: {} })
  })

  prueba('resuelve rutas con parámetros', () => {
    const resultado = resolverRuta(rutas, '/docente/estudiantes/42/reporte')
    afirmar.igual(resultado.definicion.patron, '/docente/estudiantes/:id/reporte')
    afirmar.profundo(resultado.params, { id: '42' })
  })

  prueba('acepta barra final y no confunde rutas parecidas', () => {
    afirmar.igual(resolverRuta(rutas, '/docente/').definicion.patron, '/docente')
    afirmar.igual(resolverRuta(rutas, '/docente/estudiantes').definicion.patron, '/docente/estudiantes')
  })

  prueba('devuelve null si ninguna ruta coincide', () => {
    afirmar.igual(resolverRuta(rutas, '/docente/otra'), null)
    afirmar.igual(resolverRuta(rutas, '/docente/estudiantes/1/2/reporte'), null)
  })
})
