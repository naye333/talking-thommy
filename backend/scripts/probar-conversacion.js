// Prueba de punta a punta sin la app: crea una sesión con Thommy y envía un audio por el WebSocket,
// igual que lo hace el frontend (trozos binarios entre inicio_turno y fin_turno).
//
// Uso (con el backend y el servicio de IA encendidos):
//   node scripts/probar-conversacion.js <audio> [temaId]
//   node scripts/probar-conversacion.js ../ia/tests/fixtures/student_sentence.webm
//
// Sin base de datos usa un token de prueba (solo conversación libre: temaId necesita el syllabus en la BD).
const fs = require('fs')
const WebSocket = require('ws')
const entorno = require('../src/config/entorno')
const { generarToken } = require('../src/servicios/servicioAutenticacion')

const [rutaAudio, temaIdTexto] = process.argv.slice(2)
if (!rutaAudio) {
  console.error('Uso: node scripts/probar-conversacion.js <audio> [temaId]')
  process.exit(1)
}

const base = `http://localhost:${entorno.puerto}`
const token = process.env.TOKEN || generarToken({ id: 1, rol: 'estudiante', nivel: 1 })
const TAMANO_TROZO = 4000 // ~250 ms de audio comprimido, como MediaRecorder

// Oculta el audio en base64 para que el resultado se pueda leer
const resumir = (objeto) => JSON.stringify(objeto, (clave, valor) =>
  clave === 'audioUrl' && valor ? `${valor.slice(0, 30)}… (${Math.round(valor.length / 1024)} KB)` : valor, 2)

async function principal () {
  let inicio = Date.now()
  const respuesta = await fetch(`${base}/api/sesiones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ temaId: temaIdTexto ? Number(temaIdTexto) : null })
  })
  const sesion = await respuesta.json()
  console.log(`POST /api/sesiones → ${respuesta.status} en ${Date.now() - inicio} ms\n${resumir(sesion)}`)
  if (!respuesta.ok) process.exit(1)

  const socket = new WebSocket(`ws://localhost:${entorno.puerto}/tiempo-real?sesion=${sesion.sesion.id}&token=${token}`)
  socket.on('message', (datos) => {
    const mensaje = JSON.parse(datos.toString())
    if (mensaje.tipo === 'conectado') {
      socket.send(JSON.stringify({ tipo: 'inicio_turno' }))
    } else if (mensaje.tipo === 'turno_iniciado') {
      const audio = fs.readFileSync(rutaAudio)
      for (let i = 0; i < audio.length; i += TAMANO_TROZO) socket.send(audio.subarray(i, i + TAMANO_TROZO))
      inicio = Date.now()
      socket.send(JSON.stringify({ tipo: 'fin_turno' }))
    } else if (mensaje.tipo === 'procesando') {
      console.log('\n… Thommy está procesando el turno')
    } else {
      console.log(`\n${mensaje.tipo} en ${Date.now() - inicio} ms\n${resumir(mensaje)}`)
      socket.close()
    }
  })
  socket.on('error', (error) => { console.error('WebSocket:', error.message); process.exit(1) })
}

principal().catch((error) => { console.error(error.message); process.exit(1) })
