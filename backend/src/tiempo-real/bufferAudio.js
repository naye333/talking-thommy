// Acumula en memoria los trozos de audio de un turno activo.
// Cada conexión WebSocket tiene su propio buffer; se libera al cerrar el turno.
class BufferAudio {
  constructor (maxBytes) {
    this.maxBytes = maxBytes
    this.trozos = []
    this.totalBytes = 0
    this.estaGrabando = false
  }

  iniciarTurno () {
    this.limpiar()
    this.estaGrabando = true
  }

  // Devuelve false si el trozo supera el límite permitido
  agregarTrozo (trozo) {
    if (!this.estaGrabando) return false
    if (this.totalBytes + trozo.length > this.maxBytes) return false
    this.trozos.push(trozo)
    this.totalBytes += trozo.length
    return true
  }

  // Une los trozos en un solo Buffer y reinicia el estado
  finalizarTurno () {
    const audio = Buffer.concat(this.trozos, this.totalBytes)
    this.limpiar()
    return audio
  }

  limpiar () {
    this.trozos = []
    this.totalBytes = 0
    this.estaGrabando = false
  }
}

module.exports = { BufferAudio }
