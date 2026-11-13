// Datos de la cuenta y cierre de sesión. La usan todos los perfiles con su propia barra inferior.
// Muestra el usuario guardado al instante y lo actualiza con GET /api/auth/yo.
import { html, renderizar } from '../../../nucleo/dom.js'
import { obtenerMensajeError } from '../../../nucleo/mensajesError.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { icono } from '../../../componentes/iconos.js'

const NOMBRES_ROL = { docente: 'Docente', estudiante: 'Estudiante' }
const NOMBRES_NIVEL = { 1: 'Inglés I', 2: 'Inglés II' }

function datoCuenta (etiqueta, valor) {
  if (!valor) return ''
  return html`<div class="cuenta__dato"><dt>${etiqueta}</dt><dd>${valor}</dd></div>`
}

function tarjetaCuenta (usuario, aviso) {
  return html`
    <section class="tarjeta cuenta">
      ${icono('avatarUsuario', { clase: 'cuenta__avatar' })}
      <h2 class="cuenta__nombre">${usuario?.nombre || 'Tu cuenta'}</h2>
      <dl class="cuenta__datos">
        ${datoCuenta('Correo', usuario?.correo)}
        ${datoCuenta('Rol', NOMBRES_ROL[usuario?.rol])}
        ${datoCuenta('Nivel', NOMBRES_NIVEL[usuario?.nivel])}
      </dl>
      ${aviso ? html`<p class="cuenta__aviso" role="status">${aviso}</p>` : ''}
    </section>`
}

export function crearPantallaCuenta ({ navegacion, rutaAtras }) {
  return async function pantallaCuenta ({ contenedor }, app) {
    renderizar(contenedor, plantillaPantalla({
      cabecera: encabezado({ titulo: 'Configuración', rutaAtras }),
      contenido: html`
        <div data-region="cuenta">${tarjetaCuenta(app.sesion.obtenerUsuario())}</div>
        <button class="boton-cerrar-sesion" type="button" data-accion="cerrar-sesion">
          ${icono('salir')}<span>Cerrar sesión</span>
        </button>`,
      navegacion: navegacion()
    }))

    const region = contenedor.querySelector('[data-region="cuenta"]')
    try {
      const usuario = await app.servicios.autenticacion.consultarUsuarioActual()
      app.sesion.actualizarUsuario(usuario)
      if (region.isConnected) renderizar(region, tarjetaCuenta(usuario))
    } catch (error) {
      if (region.isConnected) {
        renderizar(region, tarjetaCuenta(app.sesion.obtenerUsuario(), `No se pudo actualizar la información. ${obtenerMensajeError(error)}`))
      }
    }
  }
}
