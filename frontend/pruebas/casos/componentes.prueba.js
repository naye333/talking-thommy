import { describir, afirmar } from '../marco.js'
import { calcularPuntosGrafico, limitarPorcentaje, trazarCurva, barraProgreso } from '../../js/componentes/graficos.js'
import { obtenerIniciales, botonPrincipal } from '../../js/componentes/elementos.js'
import { barraNavegacion } from '../../js/componentes/estructura.js'
import { icono, NOMBRES_ICONOS } from '../../js/componentes/iconos.js'

describir('componentes', (prueba) => {
  prueba('limita los porcentajes entre 0 y 100', () => {
    afirmar.igual(limitarPorcentaje(120), 100)
    afirmar.igual(limitarPorcentaje(-5), 0)
    afirmar.igual(limitarPorcentaje('abc'), 0)
    afirmar.igual(limitarPorcentaje(78), 78)
  })

  prueba('ubica los puntos del gráfico dentro del área', () => {
    const area = { x: 0, y: 0, ancho: 100, alto: 60 }
    const puntos = calcularPuntosGrafico({ valores: [40, 70, 100, 150], minimo: 40, maximo: 100, area })
    afirmar.profundo(puntos.map((punto) => [Math.round(punto.x), Math.round(punto.y)]), [[0, 60], [33, 30], [67, 0], [100, 0]])
  })

  prueba('la curva empieza en el primer punto y pasa por todos', () => {
    const trazo = trazarCurva([{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 5 }])
    afirmar.verdadero(trazo.startsWith('M0.0 10.0'))
    afirmar.igual((trazo.match(/C/g) || []).length, 2)
    afirmar.verdadero(trazo.endsWith('20.0 5.0'))
  })

  prueba('obtiene las iniciales del nombre', () => {
    afirmar.igual(obtenerIniciales('Sofía Ramírez'), 'SR')
    afirmar.igual(obtenerIniciales('valentina'), 'V')
    afirmar.igual(obtenerIniciales('Ana María López Díaz'), 'AD')
    afirmar.igual(obtenerIniciales(''), '?')
  })

  prueba('la barra de progreso expone su valor a lectores de pantalla', () => {
    const texto = barraProgreso({ valor: 85, etiqueta: 'Pronunciación' }).texto
    afirmar.verdadero(texto.includes('aria-valuenow="85"'))
    afirmar.verdadero(texto.includes('width: 85%'))
  })

  prueba('marca como activo solo el elemento indicado de la barra inferior', () => {
    const texto = barraNavegacion({
      activo: 'b',
      elementos: [{ id: 'a', etiqueta: 'A', icono: 'casa', ruta: '/a' }, { id: 'b', etiqueta: 'B', icono: 'casa', ruta: '/b' }]
    }).texto
    afirmar.igual((texto.match(/aria-current="page"/g) || []).length, 1)
    afirmar.verdadero(texto.includes('href="#/b" aria-current="page"'))
  })

  prueba('un botón deshabilitado no se convierte en enlace', () => {
    const texto = botonPrincipal({ texto: 'Enviar', href: '/x', deshabilitado: true }).texto
    afirmar.verdadero(texto.includes('<button'))
    afirmar.verdadero(texto.includes('disabled'))
  })

  prueba('todos los iconos generan un SVG y los desconocidos fallan', () => {
    for (const nombre of NOMBRES_ICONOS) afirmar.verdadero(icono(nombre).texto.startsWith('<svg'), nombre)
    let fallo = false
    try { icono('no-existe') } catch { fallo = true }
    afirmar.verdadero(fallo, 'debería fallar con un icono desconocido')
  })
})
