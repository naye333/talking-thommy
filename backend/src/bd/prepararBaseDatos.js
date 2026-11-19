// Deja la base de datos lista al arrancar el servidor: aplica las migraciones pendientes y,
// si todavía no hay syllabus, lo carga. Así nadie tiene que acordarse de npm run migrar.
const { obtenerPool } = require('../config/baseDatos')
const { ejecutarMigraciones } = require('./migrar')
const { sembrarTodo } = require('./sembrarSyllabus')

async function prepararBaseDatos ({ log = console.log } = {}) {
  const migraciones = await ejecutarMigraciones({ log })
  const { rows } = await obtenerPool().query('SELECT count(*) AS total FROM temas')
  const sembroSyllabus = Number(rows[0].total) === 0
  if (sembroSyllabus) await sembrarTodo(undefined, { log })
  return { migraciones, sembroSyllabus }
}

module.exports = { prepararBaseDatos }
