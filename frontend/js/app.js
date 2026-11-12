// Punto de entrada: arma la sesión, el cliente de la API, los servicios y las rutas de cada perfil.
import { configuracion } from './config.js'
import { crearEnrutador } from './nucleo/enrutador.js'
import { crearSesion, crearAlmacenSeguro } from './nucleo/sesion.js'
import { crearClienteApi } from './nucleo/clienteApi.js'
import { crearServicioAutenticacion } from './servicios/servicioAutenticacion.js'
import { crearServicioDocente } from './servicios/docente/servicioDocente.js'
import { crearRutasComunes, obtenerRutaInicio } from './perfiles/comun/rutas.js'
import { crearRutasDocente } from './perfiles/docente/rutas.js'
import { crearRutasEstudiante } from './perfiles/estudiante/rutas.js'
import { pantallaNoEncontrada } from './perfiles/comun/pantallas/noEncontrada.js'

const contenedor = document.getElementById('app')
const sesion = crearSesion({ almacen: crearAlmacenSeguro(() => window.localStorage) })
let enrutador = null

const cliente = crearClienteApi({
  urlBase: configuracion.urlApi,
  obtenerToken: () => sesion.obtenerToken(),
  // El backend rechazó el token (vencido o inválido): se vuelve al ingreso
  alSesionInvalida: () => {
    sesion.cerrar()
    enrutador?.navegar('/ingreso', { reemplazar: true })
  }
})

// Contexto compartido que reciben las rutas de todos los perfiles
const app = {
  configuracion,
  sesion,
  servicios: {
    autenticacion: crearServicioAutenticacion(cliente),
    docente: crearServicioDocente({ usarDatosEjemplo: configuracion.usarDatosEjemplo })
  },
  rutaInicio: () => obtenerRutaInicio(sesion.obtenerUsuario()),
  cerrarSesion () {
    sesion.cerrar()
    enrutador.navegar('/ingreso', { reemplazar: true })
  }
}

// Protege cada ruta según si hay sesión y el rol del usuario
function protegerRuta (definicion) {
  const usuario = sesion.obtenerUsuario()
  if (definicion.redirigirAInicio) return app.rutaInicio()
  if (definicion.soloSinSesion) return usuario ? app.rutaInicio() : null
  if (definicion.perfil && !usuario) return '/ingreso'
  if (definicion.perfil && usuario.rol !== definicion.perfil) return app.rutaInicio()
  return null
}

enrutador = crearEnrutador({
  contenedor,
  rutas: [...crearRutasComunes(app), ...crearRutasDocente(app), ...crearRutasEstudiante(app)],
  antesDeEntrar: protegerRuta,
  alNoEncontrar: pantallaNoEncontrada
})

// Acciones globales disponibles en cualquier pantalla
contenedor.addEventListener('click', (evento) => {
  const atras = evento.target.closest('[data-accion="atras"]')
  if (atras) {
    enrutador.atras(atras.dataset.rutaAtras || app.rutaInicio())
    return
  }
  if (evento.target.closest('[data-accion="cerrar-sesion"]')) app.cerrarSesion()
})

enrutador.iniciar()
