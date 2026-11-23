// Micrófono "mantén presionado para hablar" (como las notas de voz de WhatsApp):
// presionar → empieza a grabar; soltar → envía. Si se suelta muy rápido, se cancela.
// No depende del DOM: la pantalla llama a presionar() y soltar() desde los eventos del botón.
//
// empezar(): async, abre el micrófono y empieza el turno. Devuelve false si no se pudo.
// terminar(): async, detiene la grabación y espera la respuesta de Thommy.
// cancelar(motivo): descarta la grabación ('corta' si se soltó antes de duracionMinimaMs).
export function crearControlPulsacion ({ empezar, terminar, cancelar, duracionMinimaMs = 600, ahora = () => Date.now() }) {
  let estado = 'libre'
  let inicio = 0
  let soltoMientrasIniciaba = false
  // Cambia con cada pulsación y cada descarte: una pulsación vieja no toca el estado de una nueva
  let pulsacion = 0

  async function finalizar () {
    if (ahora() - inicio < duracionMinimaMs) {
      estado = 'libre'
      cancelar('corta')
      return
    }
    estado = 'enviando'
    try {
      await terminar()
    } finally {
      estado = 'libre'
    }
  }

  return {
    get estado () {
      return estado
    },

    async presionar () {
      // Mientras graba o espera a Thommy, otra pulsación no hace nada
      if (estado !== 'libre') return
      const actual = ++pulsacion
      estado = 'iniciando'
      soltoMientrasIniciaba = false
      inicio = ahora()
      let pudoEmpezar = false
      try {
        pudoEmpezar = await empezar()
      } catch {
        pudoEmpezar = false
      }
      // Se descartó mientras abría el micrófono: esta pulsación ya no cuenta
      if (actual !== pulsacion) {
        if (pudoEmpezar) cancelar('descartada')
        return
      }
      if (!pudoEmpezar) {
        estado = 'libre'
        return
      }
      estado = 'grabando'
      // Abrir el micrófono tarda: si ya soltó el botón, se decide ahora
      if (soltoMientrasIniciaba) await finalizar()
    },

    async soltar () {
      if (estado === 'iniciando') {
        soltoMientrasIniciaba = true
        return
      }
      if (estado === 'grabando') await finalizar()
    },

    // Descarta lo grabado (por ejemplo, al salir de la pantalla)
    descartar () {
      pulsacion++
      if (estado === 'grabando') cancelar('descartada')
      if (estado !== 'enviando') estado = 'libre'
    }
  }
}
