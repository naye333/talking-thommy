// Estados de carga, error y vacío, y una ayuda para llenar una región con datos asíncronos.
import { html, renderizar } from '../nucleo/dom.js'
import { obtenerMensajeError } from '../nucleo/mensajesError.js'
import { icono } from './iconos.js'

export function estadoCargando (texto = 'Cargando…') {
  return html`
    <div class="estado estado--cargando" role="status">
      <span class="estado__indicador" aria-hidden="true"></span>
      <p class="estado__texto">${texto}</p>
    </div>`
}

export function estadoError (mensaje, { conReintento = true } = {}) {
  return html`
    <div class="estado estado--error" role="alert">
      ${icono('alertaRoja', { clase: 'estado__icono' })}
      <p class="estado__texto">${mensaje}</p>
      ${conReintento ? html`<button class="boton-secundario" type="button" data-accion="reintentar">Reintentar</button>` : ''}
    </div>`
}

export function estadoVacio ({ titulo, texto }) {
  return html`
    <div class="estado estado--vacio">
      <p class="estado__titulo">${titulo}</p>
      ${texto ? html`<p class="estado__texto">${texto}</p>` : ''}
    </div>`
}

// Muestra "cargando", luego el contenido o un error con botón para reintentar.
// cargar() → Promise<datos>; mostrar(datos) → plantilla; alMostrar(datos, region) → conecta eventos
export async function cargarRegion (region, { cargar, mostrar, alMostrar, textoCargando }) {
  renderizar(region, estadoCargando(textoCargando))
  try {
    const datos = await cargar()
    if (!region.isConnected) return
    renderizar(region, mostrar(datos))
    if (alMostrar) alMostrar(datos, region)
  } catch (error) {
    if (!region.isConnected) return
    // Reintentar no sirve si el recurso no existe o el servicio aún no está implementado
    const conReintento = ![404, 501].includes(error.estado)
    renderizar(region, estadoError(obtenerMensajeError(error), { conReintento }))
    region.querySelector('[data-accion="reintentar"]')?.addEventListener('click', () => {
      cargarRegion(region, { cargar, mostrar, alMostrar, textoCargando })
    }, { once: true })
  }
}
