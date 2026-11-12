// Rutas del perfil docente. Todas exigen una sesión con rol "docente".
import { pantallaInicioDocente } from './pantallas/inicio.js'
import { crearPantallaCuenta } from '../comun/pantallas/cuenta.js'
import { navegacionDocente, RUTAS_DOCENTE } from './navegacion.js'

const pantallaCuentaDocente = crearPantallaCuenta({ navegacion: navegacionDocente, rutaAtras: RUTAS_DOCENTE.inicio })

export function crearRutasDocente (app) {
  const ruta = (patron, pantalla) => ({ patron, perfil: 'docente', pantalla: (contexto) => pantalla(contexto, app) })
  return [
    ruta('/docente', pantallaInicioDocente),
    ruta('/docente/configuracion', pantallaCuentaDocente)
  ]
}
