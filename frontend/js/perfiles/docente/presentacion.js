// Textos e iconos que el perfil docente usa para mostrar los datos del servicio
export const NOMBRES_NIVEL = { 1: 'Inglés I', 2: 'Inglés II' }

export function textoNivel (nivel) {
  return `Nivel: ${NOMBRES_NIVEL[nivel] || 'sin asignar'}`
}

export const ICONO_POR_AREA = {
  gramatica: 'cerebro',
  vocabulario: 'libro',
  fluidez: 'engranajeColor',
  pronunciacion: 'exclamacion'
}

export function formatearVariacion (variacion) {
  const numero = Math.round(Number(variacion) || 0)
  return `${numero > 0 ? '+' : ''}${numero}%`
}
