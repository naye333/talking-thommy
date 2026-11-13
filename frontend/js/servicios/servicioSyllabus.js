// Endpoints reales del syllabus (backend/src/rutas/syllabus.js). Requieren sesión.

export function crearServicioSyllabus (cliente) {
  return {
    // GET /api/syllabus[?nivel=N] → { nivel, unidades: [{ id, numero, titulo, descripcion, temas: [{ id, numero, semana, titulo }] }] }
    listar ({ nivel } = {}) {
      return cliente.get(`/api/syllabus${nivel ? `?nivel=${encodeURIComponent(nivel)}` : ''}`)
    },

    // GET /api/syllabus/temas/:id → { tema: { id, nivel, unidadTitulo, semana, titulo, objetivo, gramatica, vocabulario, frasesModelo } }
    async consultarTema (id) {
      const { tema } = await cliente.get(`/api/syllabus/temas/${encodeURIComponent(id)}`)
      return tema
    }
  }
}
