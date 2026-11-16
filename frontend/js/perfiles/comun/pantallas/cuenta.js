// Datos de la cuenta, grupo, cambio de contraseña y cierre de sesión. La usan todos los perfiles.
// Muestra el usuario guardado al instante y lo actualiza con GET /api/auth/yo.
import { html, renderizar } from '../../../nucleo/dom.js'
import { obtenerMensajeError, agruparDetallesPorCampo } from '../../../nucleo/mensajesError.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { icono } from '../../../componentes/iconos.js'
import { MIN_CONTRASENA, MAX_CONTRASENA } from '../formularios.js'

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

function campo ({ id, nombre, etiqueta, tipo = 'text', autocompletar = 'off', maximo }) {
  return html`
    <div class="campo">
      <label class="campo__etiqueta" for="${id}">${etiqueta}</label>
      <input class="campo__entrada" id="${id}" name="${nombre}" type="${tipo}" autocomplete="${autocompletar}"
             ${maximo ? html`maxlength="${maximo}"` : ''} aria-describedby="${id}-error">
      <p class="campo__error" id="${id}-error" data-error-de="${nombre}"></p>
    </div>`
}

// ---------- Grupo del docente ----------

function contenidoGrupoDocente (codigo) {
  return html`
    <p class="grupo__codigo" data-codigo>${codigo}</p>
    <p class="grupo__ayuda">Compártelo con tus estudiantes: lo escriben al registrarse o en su perfil para aparecer en tu lista.</p>
    <button class="boton-contorno" type="button" data-accion="regenerar-codigo">Generar un código nuevo</button>
    <p class="mensaje-error" role="alert" data-mensaje-grupo></p>`
}

function contenidoGrupoEstudiante (docente) {
  if (docente) {
    return html`<p class="grupo__ayuda">Estás en el grupo de <strong>${docente.nombre}</strong>. Tu docente puede ver tu progreso.</p>`
  }
  return html`
    <p class="grupo__ayuda">Escribe el código que te dio tu docente para que pueda ver tu progreso.</p>
    <form class="grupo__formulario" data-formulario="grupo" novalidate>
      ${campo({ id: 'cuenta-codigo', nombre: 'codigo', etiqueta: 'Código de grupo', maximo: 20 })}
      <button class="boton-principal" type="submit">Unirme al grupo</button>
    </form>
    <p class="mensaje-error" role="alert" data-mensaje-grupo></p>`
}

async function montarGrupo (seccion, usuario, servicio) {
  const contenido = seccion.querySelector('[data-region="grupo"]')
  const esDocente = usuario?.rol === 'docente'
  try {
    if (esDocente) {
      renderizar(contenido, contenidoGrupoDocente(await servicio.consultarCodigoGrupo()))
    } else {
      renderizar(contenido, contenidoGrupoEstudiante(await servicio.consultarMiGrupo()))
    }
  } catch (error) {
    if (contenido.isConnected) renderizar(contenido, html`<p class="cuenta__aviso">No se pudo cargar tu grupo. ${obtenerMensajeError(error)}</p>`)
    return
  }

  contenido.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-accion="regenerar-codigo"]')
    if (!boton) return
    boton.disabled = true
    try {
      contenido.querySelector('[data-codigo]').textContent = await servicio.regenerarCodigoGrupo()
    } catch (error) {
      contenido.querySelector('[data-mensaje-grupo]').textContent = obtenerMensajeError(error)
    }
    boton.disabled = false
  })

  contenido.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    const formulario = evento.target
    const codigo = formulario.elements.codigo.value.trim()
    const mensaje = contenido.querySelector('[data-mensaje-grupo]')
    const error = formulario.querySelector('[data-error-de="codigo"]')
    error.textContent = codigo ? '' : 'Escribe el código.'
    if (!codigo) return
    const boton = formulario.querySelector('button')
    boton.disabled = true
    try {
      const docente = await servicio.unirmeAGrupo(codigo)
      if (contenido.isConnected) renderizar(contenido, contenidoGrupoEstudiante(docente))
    } catch (falla) {
      mensaje.textContent = obtenerMensajeError(falla)
      boton.disabled = false
    }
  })
}

// ---------- Cambio de contraseña ----------

export function validarCambioContrasena ({ contrasenaActual, contrasenaNueva, confirmacion }) {
  const errores = {}
  if (!contrasenaActual) errores.contrasenaActual = 'Escribe tu contraseña actual.'
  if (contrasenaNueva.length < MIN_CONTRASENA) errores.contrasenaNueva = `Mínimo ${MIN_CONTRASENA} caracteres.`
  else if (contrasenaNueva.length > MAX_CONTRASENA) errores.contrasenaNueva = `Máximo ${MAX_CONTRASENA} caracteres.`
  else if (contrasenaNueva === contrasenaActual) errores.contrasenaNueva = 'Debe ser diferente de la actual.'
  if (confirmacion !== contrasenaNueva) errores.confirmacion = 'Las contraseñas no coinciden.'
  return errores
}

function seccionContrasena () {
  return html`
    <section class="tarjeta seccion-cuenta">
      <h2 class="seccion-cuenta__titulo">${icono('candado', { clase: 'seccion-cuenta__icono' })}Cambiar contraseña</h2>
      <form class="seccion-cuenta__formulario" data-formulario="contrasena" novalidate>
        ${campo({ id: 'cuenta-actual', nombre: 'contrasenaActual', etiqueta: 'Contraseña actual', tipo: 'password', autocompletar: 'current-password' })}
        ${campo({ id: 'cuenta-nueva', nombre: 'contrasenaNueva', etiqueta: 'Contraseña nueva', tipo: 'password', autocompletar: 'new-password' })}
        ${campo({ id: 'cuenta-confirmacion', nombre: 'confirmacion', etiqueta: 'Confirmar contraseña nueva', tipo: 'password', autocompletar: 'new-password' })}
        <p class="mensaje-error" role="alert" data-mensaje-contrasena></p>
        <p class="seccion-cuenta__exito" role="status" data-exito-contrasena></p>
        <button class="boton-principal" type="submit">Guardar contraseña</button>
      </form>
    </section>`
}

function montarContrasena (contenedor, servicio) {
  const formulario = contenedor.querySelector('[data-formulario="contrasena"]')
  const mensaje = formulario.querySelector('[data-mensaje-contrasena]')
  const exito = formulario.querySelector('[data-exito-contrasena]')
  const boton = formulario.querySelector('button')

  function mostrarErrores (porCampo) {
    for (const parrafo of formulario.querySelectorAll('[data-error-de]')) {
      const nombre = parrafo.dataset.errorDe
      parrafo.textContent = porCampo[nombre] || ''
      formulario.elements[nombre].setAttribute('aria-invalid', porCampo[nombre] ? 'true' : 'false')
    }
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    mensaje.textContent = ''
    exito.textContent = ''
    const datos = {
      contrasenaActual: formulario.elements.contrasenaActual.value,
      contrasenaNueva: formulario.elements.contrasenaNueva.value,
      confirmacion: formulario.elements.confirmacion.value
    }
    const errores = validarCambioContrasena(datos)
    mostrarErrores(errores)
    if (Object.keys(errores).length > 0) return

    boton.disabled = true
    try {
      await servicio.cambiarContrasena(datos)
      formulario.reset()
      exito.textContent = 'Tu contraseña se actualizó.'
    } catch (error) {
      mostrarErrores(agruparDetallesPorCampo(error))
      if (error.codigo !== 'DATOS_INVALIDOS' && error.codigo !== 'CONTRASENA_INCORRECTA') mensaje.textContent = obtenerMensajeError(error)
    }
    boton.disabled = false
  })
}

export function crearPantallaCuenta ({ navegacion, rutaAtras }) {
  return async function pantallaCuenta ({ contenedor }, app) {
    const usuarioGuardado = app.sesion.obtenerUsuario()
    const tituloGrupo = usuarioGuardado?.rol === 'docente' ? 'Código de tu grupo' : 'Tu grupo'
    renderizar(contenedor, plantillaPantalla({
      cabecera: encabezado({ titulo: 'Configuración', rutaAtras }),
      contenido: html`
        <div data-region="cuenta">${tarjetaCuenta(usuarioGuardado)}</div>
        <section class="tarjeta seccion-cuenta" data-seccion="grupo">
          <h2 class="seccion-cuenta__titulo">${icono('estudiantesTrazo', { clase: 'seccion-cuenta__icono' })}${tituloGrupo}</h2>
          <div class="grupo" data-region="grupo"><p class="grupo__ayuda">Cargando…</p></div>
        </section>
        ${seccionContrasena()}
        <button class="boton-cerrar-sesion" type="button" data-accion="cerrar-sesion">
          ${icono('salir')}<span>Cerrar sesión</span>
        </button>`,
      navegacion: navegacion()
    }))

    const servicioCuenta = app.servicios.cuenta
    montarContrasena(contenedor, servicioCuenta)
    void montarGrupo(contenedor.querySelector('[data-seccion="grupo"]'), usuarioGuardado, servicioCuenta)

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
