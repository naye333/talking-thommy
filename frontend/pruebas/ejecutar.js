// Ejecuta las pruebas en Node: npm test
import { ejecutarPruebas } from './marco.js'
import './todas.js'

const resultados = await ejecutarPruebas()
const fallidas = resultados.filter((resultado) => !resultado.aprobada)

for (const resultado of resultados) {
  console.log(`${resultado.aprobada ? '✔' : '✘'} ${resultado.nombre}${resultado.aprobada ? '' : `\n    ${resultado.error}`}`)
}
console.log(`\n${resultados.length - fallidas.length}/${resultados.length} pruebas aprobadas`)
process.exitCode = fallidas.length > 0 ? 1 : 0
