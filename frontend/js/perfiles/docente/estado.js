// Recuerda el último estudiante consultado para resaltarlo en la lista (como en el diseño)
import { crearAlmacenSeguro } from '../../nucleo/sesion.js'

const CLAVE = 'tt.docente.estudianteSeleccionado'
const almacen = crearAlmacenSeguro(() => globalThis.sessionStorage)

export const seleccionEstudiante = {
  obtener () {
    return Number(almacen.leer(CLAVE)) || null
  },
  guardar (id) {
    almacen.escribir(CLAVE, String(id))
  }
}
