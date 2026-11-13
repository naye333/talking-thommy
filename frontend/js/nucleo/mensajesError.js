// Traduce los códigos de error del backend (ver backend/README.md) a mensajes para el usuario.

const MENSAJES = {
  DATOS_INVALIDOS: 'Revisa los datos ingresados.',
  JSON_INVALIDO: 'La solicitud no tiene un formato válido.',
  CREDENCIALES_INVALIDAS: 'Correo o contraseña incorrectos.',
  TOKEN_REQUERIDO: 'Tu sesión terminó. Inicia sesión de nuevo.',
  TOKEN_INVALIDO: 'Tu sesión terminó. Inicia sesión de nuevo.',
  PERMISO_DENEGADO: 'No tienes permiso para ver esta información.',
  USUARIO_NO_ENCONTRADO: 'No encontramos tu cuenta.',
  CORREO_EN_USO: 'Ese correo ya está registrado.',
  TEMA_NO_ENCONTRADO: 'No encontramos ese tema del syllabus.',
  ESTUDIANTE_NO_ENCONTRADO: 'No encontramos a ese estudiante.',
  RECOMENDACION_NO_ENCONTRADA: 'No encontramos esa sugerencia.',
  BASE_DATOS_NO_DISPONIBLE: 'El servicio no está disponible en este momento. Intenta más tarde.',
  SERVICIO_NO_DISPONIBLE: 'Esta función todavía no está disponible.',
  RUTA_NO_ENCONTRADA: 'Esta función todavía no está disponible en el servidor.',
  SIN_CONEXION: 'No pudimos conectar con el servidor. Revisa tu conexión.',
  MICROFONO_DENEGADO: 'Necesitamos permiso para usar el micrófono. Actívalo en la configuración del dispositivo.',
  MICROFONO_NO_ENCONTRADO: 'No encontramos un micrófono en este dispositivo.',
  MICROFONO_NO_DISPONIBLE: 'El micrófono no está disponible en este dispositivo.',
  AUDIO_VACIO: 'No escuchamos nada. Mantén el micrófono cerca e inténtalo de nuevo.',
  AUDIO_DEMASIADO_GRANDE: 'La grabación es muy larga. Intenta con una frase más corta.',
  TUTOR_NO_DISPONIBLE: 'Thommy todavía no puede responder desde el servidor. Intenta más tarde.',
  SESION_REQUERIDA: 'No se pudo iniciar la conversación. Intenta de nuevo.',
  ERROR_PROCESAMIENTO: 'Thommy no pudo procesar tu audio. Intenta de nuevo.',
  ERROR_INTERNO: 'Ocurrió un error inesperado. Intenta de nuevo.'
}

export function obtenerMensajeError (error) {
  return MENSAJES[error?.codigo] || MENSAJES.ERROR_INTERNO
}

// Convierte detalles [{ campo, mensaje }] en { campo: mensaje } para mostrarlos junto a cada campo
export function agruparDetallesPorCampo (error) {
  const porCampo = {}
  for (const { campo, mensaje } of error?.detalles || []) {
    if (campo && !porCampo[campo]) porCampo[campo] = mensaje
  }
  return porCampo
}
