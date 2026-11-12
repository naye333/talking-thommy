// Configuración del frontend. Ajusta urlApi al desplegar (por ejemplo, con la URL de Render).
export const configuracion = Object.freeze({
  urlApi: 'http://localhost:3000',

  // El backend todavía no tiene endpoints para el perfil docente (estudiantes, reportes,
  // falencias, recomendaciones). Mientras sea true, esas pantallas usan datos de ejemplo.
  // Ver docs/propuesta-api-perfil-docente.md
  usarDatosEjemplo: true
})
