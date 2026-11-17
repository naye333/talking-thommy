import { describir, afirmar } from '../marco.js'
import { resolverUrlApi } from '../../js/config.js'

const ubicacion = (url) => {
  const { protocol, hostname, port, origin } = new URL(url)
  return { protocol, hostname, port, origin }
}

describir('configuracion', (prueba) => {
  prueba('servida por el backend usa la misma dirección para la API', () => {
    afirmar.igual(resolverUrlApi(ubicacion('https://talking-thommy.onrender.com/#/ingreso'), ''), 'https://talking-thommy.onrender.com')
    afirmar.igual(resolverUrlApi(ubicacion('http://localhost:3000/'), ''), 'http://localhost:3000')
  })

  prueba('en desarrollo, en la app móvil sin URL y en Node usa el backend local', () => {
    afirmar.igual(resolverUrlApi(ubicacion('http://localhost:8081/'), ''), 'http://localhost:3000')
    afirmar.igual(resolverUrlApi(ubicacion('https://localhost/'), ''), 'http://localhost:3000')
    afirmar.igual(resolverUrlApi(undefined, ''), 'http://localhost:3000')
  })

  prueba('la URL fija de la app móvil tiene prioridad', () => {
    afirmar.igual(resolverUrlApi(ubicacion('https://localhost/'), 'https://api.ejemplo.com'), 'https://api.ejemplo.com')
  })
})
