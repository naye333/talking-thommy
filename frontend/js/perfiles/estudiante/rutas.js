// Punto de entrada del perfil de estudiante. Sus pantallas se desarrollarán con sus propios diseños;
// mientras tanto, un estudiante que inicia sesión ve este aviso en lugar de una página vacía.
import { html, renderizar } from '../../nucleo/dom.js'
import { plantillaPantalla } from '../../componentes/estructura.js'
import { estadoVacio } from '../../componentes/estados.js'
import { mascota, botonPrincipal } from '../../componentes/elementos.js'

function pantallaEstudiantePendiente ({ contenedor }) {
  renderizar(contenedor, plantillaPantalla({
    clase: 'pantalla--sin-navegacion pantalla-ingreso',
    contenido: html`
      ${mascota({ variante: 'animo', clase: 'pantalla-ingreso__mascota' })}
      ${estadoVacio({ titulo: 'El perfil de estudiante está en construcción', texto: 'Muy pronto podrás practicar con Thommy desde aquí.' })}
      ${botonPrincipal({ texto: 'Cerrar sesión', accion: 'cerrar-sesion' })}`
  }))
}

export function crearRutasEstudiante () {
  return [
    { patron: '/estudiante', perfil: 'estudiante', pantalla: pantallaEstudiantePendiente }
  ]
}
