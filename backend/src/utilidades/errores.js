// Crea errores con estado HTTP y código que el manejador central entiende
function crearError (estado, codigo, detalles) {
  const error = new Error(codigo)
  error.estado = estado
  error.codigo = codigo
  if (detalles) error.detalles = detalles
  return error
}

module.exports = { crearError }
