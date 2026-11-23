import { describir, afirmar } from '../marco.js'
import { crearControlPulsacion } from '../../js/servicios/estudiante/pulsarParaHablar.js'

// Reloj y micrófono falsos: se controla cuándo termina de abrirse el micrófono y cuánto tiempo pasa
function crearEscenario ({ puedeEmpezar = true, duracionMinimaMs = 600 } = {}) {
  const registro = []
  let reloj = 0
  let abrirMicrofono = null
  const control = crearControlPulsacion({
    duracionMinimaMs,
    ahora: () => reloj,
    empezar: () => {
      registro.push('empezar')
      return new Promise((resolve) => { abrirMicrofono = () => resolve(puedeEmpezar) })
    },
    terminar: async () => { registro.push('terminar') },
    cancelar: (motivo) => { registro.push(`cancelar:${motivo}`) }
  })
  return {
    control,
    registro,
    avanzar: (ms) => { reloj += ms },
    abrir: async () => {
      abrirMicrofono()
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
}

describir('pulsar para hablar', (prueba) => {
  prueba('presionar graba y soltar envía el turno', async () => {
    const { control, registro, avanzar, abrir } = crearEscenario()
    const pulsacion = control.presionar()
    await abrir()
    await pulsacion
    afirmar.igual(control.estado, 'grabando')
    avanzar(2000)
    await control.soltar()
    afirmar.profundo(registro, ['empezar', 'terminar'])
    afirmar.igual(control.estado, 'libre')
  })

  prueba('soltar muy rápido cancela sin enviar', async () => {
    const { control, registro, avanzar, abrir } = crearEscenario()
    const pulsacion = control.presionar()
    await abrir()
    await pulsacion
    avanzar(200)
    await control.soltar()
    afirmar.profundo(registro, ['empezar', 'cancelar:corta'])
    afirmar.igual(control.estado, 'libre')
  })

  prueba('si suelta mientras se abre el micrófono, se decide al terminar de abrirlo', async () => {
    const { control, registro, avanzar, abrir } = crearEscenario()
    const pulsacion = control.presionar()
    avanzar(1500)
    await control.soltar()
    afirmar.profundo(registro, ['empezar'])
    await abrir()
    await pulsacion
    afirmar.profundo(registro, ['empezar', 'terminar'])
    afirmar.igual(control.estado, 'libre')
  })

  prueba('mientras graba o espera a Thommy, otra pulsación no hace nada', async () => {
    let terminarTurno = null
    const registro = []
    const control = crearControlPulsacion({
      duracionMinimaMs: 0,
      empezar: async () => { registro.push('empezar'); return true },
      terminar: () => new Promise((resolve) => { terminarTurno = resolve }),
      cancelar: () => registro.push('cancelar')
    })
    await control.presionar()
    await control.presionar()
    const envio = control.soltar()
    afirmar.igual(control.estado, 'enviando')
    await control.presionar()
    terminarTurno()
    await envio
    afirmar.profundo(registro, ['empezar'])
    afirmar.igual(control.estado, 'libre')
  })

  prueba('si el micrófono no se pudo abrir, vuelve a quedar libre', async () => {
    const { control, abrir } = crearEscenario({ puedeEmpezar: false })
    const pulsacion = control.presionar()
    await abrir()
    await pulsacion
    afirmar.igual(control.estado, 'libre')
  })

  prueba('descartar mientras se abre el micrófono cancela esa grabación', async () => {
    const { control, registro, abrir } = crearEscenario()
    const pulsacion = control.presionar()
    control.descartar()
    await abrir()
    await pulsacion
    afirmar.profundo(registro, ['empezar', 'cancelar:descartada'])
    afirmar.igual(control.estado, 'libre')
  })
})
