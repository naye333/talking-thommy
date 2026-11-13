// Rutas del perfil estudiante. Todas exigen una sesión con rol "estudiante".
import { crearPantallaCuenta } from '../comun/pantallas/cuenta.js'
import { pantallaInicioEstudiante } from './pantallas/inicio.js'
import { pantallaConversacion } from './pantallas/conversacion.js'
import { pantallaLecciones } from './pantallas/lecciones.js'
import { pantallaTema } from './pantallas/tema.js'
import { pantallaProgreso } from './pantallas/progreso.js'
import { navegacionEstudiante, RUTAS_ESTUDIANTE } from './navegacion.js'

const pantallaPerfil = crearPantallaCuenta({ navegacion: () => navegacionEstudiante('perfil'), rutaAtras: RUTAS_ESTUDIANTE.inicio })

export function crearRutasEstudiante (app) {
  const ruta = (patron, pantalla) => ({ patron, perfil: 'estudiante', pantalla: (contexto) => pantalla(contexto, app) })
  return [
    ruta('/estudiante', pantallaInicioEstudiante),
    ruta('/estudiante/conversacion', pantallaConversacion),
    ruta('/estudiante/lecciones', pantallaLecciones),
    ruta('/estudiante/lecciones/temas/:id', pantallaTema),
    ruta('/estudiante/progreso', pantallaProgreso),
    ruta('/estudiante/perfil', pantallaPerfil)
  ]
}
