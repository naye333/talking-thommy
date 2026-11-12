// Rutas que no pertenecen a un perfil: ingreso y redirección inicial según el rol.
import { pantallaIngreso } from './pantallas/ingreso.js'

const RUTA_INICIO_POR_ROL = {
  docente: '/docente',
  estudiante: '/estudiante'
}

export function obtenerRutaInicio (usuario) {
  return (usuario && RUTA_INICIO_POR_ROL[usuario.rol]) || '/ingreso'
}

export function crearRutasComunes (app) {
  return [
    { patron: '/', redirigirAInicio: true, pantalla: () => {} },
    { patron: '/ingreso', soloSinSesion: true, pantalla: (contexto) => pantallaIngreso(contexto, app) }
  ]
}
