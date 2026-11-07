const { BufferAudio } = require('../src/tiempo-real/bufferAudio')

describe('BufferAudio', () => {
  test('rechaza trozos si el turno no ha iniciado', () => {
    const buffer = new BufferAudio(100)
    expect(buffer.agregarTrozo(Buffer.alloc(10))).toBe(false)
  })

  test('acumula trozos y los une al finalizar', () => {
    const buffer = new BufferAudio(100)
    buffer.iniciarTurno()
    buffer.agregarTrozo(Buffer.from([1, 2]))
    buffer.agregarTrozo(Buffer.from([3]))

    const audio = buffer.finalizarTurno()

    expect([...audio]).toEqual([1, 2, 3])
    expect(buffer.totalBytes).toBe(0)
    expect(buffer.estaGrabando).toBe(false)
  })

  test('rechaza trozos que superan el límite', () => {
    const buffer = new BufferAudio(5)
    buffer.iniciarTurno()
    expect(buffer.agregarTrozo(Buffer.alloc(4))).toBe(true)
    expect(buffer.agregarTrozo(Buffer.alloc(2))).toBe(false)
  })
})
