// "¿Olvidaste tu contraseña?" en dos pasos:
// 1. Correo, captcha ("no soy un robot") y código de la clase → POST /api/auth/recuperar/verificar
// 2. Contraseña nueva → POST /api/auth/recuperar/cambiar
import { html, renderizar } from '../../../nucleo/dom.js'
import { obtenerMensajeError, agruparDetallesPorCampo } from '../../../nucleo/mensajesError.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { mascota } from '../../../componentes/elementos.js'
import { campoConIcono, prepararFormulario, EXPRESION_CORREO, MIN_CONTRASENA, MAX_CONTRASENA } from '../formularios.js'

export function validarPasoVerificacion ({ correo, captchaRespuesta, codigoGrupo }) {
  const errores = {}
  if (!correo) errores.correo = 'Escribe tu correo.'
  else if (!EXPRESION_CORREO.test(correo)) errores.correo = 'Correo no válido.'
  if (!captchaRespuesta) errores.captchaRespuesta = 'Escribe las letras de la imagen.'
  if (!codigoGrupo) errores.codigoGrupo = 'Escribe el código de tu clase.'
  return errores
}

export function validarPasoContrasena ({ contrasenaNueva, confirmacion }) {
  const errores = {}
  if (contrasenaNueva.length < MIN_CONTRASENA) errores.contrasenaNueva = `Mínimo ${MIN_CONTRASENA} caracteres.`
  else if (contrasenaNueva.length > MAX_CONTRASENA) errores.contrasenaNueva = `Máximo ${MAX_CONTRASENA} caracteres.`
  if (confirmacion !== contrasenaNueva) errores.confirmacion = 'Las contraseñas no coinciden.'
  return errores
}

function textos (titulo, subtitulo) {
  return html`
    <div class="pantalla-acceso__textos">
      <h1 class="pantalla-acceso__titulo">${titulo}</h1>
      <p class="pantalla-acceso__subtitulo">${subtitulo}</p>
    </div>`
}

export function pantallaRecuperar ({ contenedor, navegar }, app) {
  const autenticacion = app.servicios.autenticacion

  function pintar ({ titulo, subtitulo, contenido, variante = 'bienvenida' }) {
    renderizar(contenedor, plantillaPantalla({
      clase: 'pantalla--sin-navegacion pantalla-acceso pantalla-acceso--registro',
      cabecera: encabezado({ titulo: '', rutaAtras: '/ingreso' }),
      contenido: html`
        ${mascota({ variante, clase: 'pantalla-acceso__mascota pantalla-acceso__mascota--chica' })}
        ${textos(titulo, subtitulo)}
        ${contenido}
        <p class="pantalla-acceso__alterno">¿Ya la recordaste? <a href="#/ingreso">Inicia sesión</a></p>`
    }))
  }

  // ---------- Paso 1: ¿eres tú? ----------
  function pasoVerificacion () {
    pintar({
      titulo: '¿Olvidaste tu contraseña?',
      subtitulo: 'Paso 1 de 2 · Confirma que eres tú',
      contenido: html`
        <form class="pantalla-acceso__formulario" novalidate>
          ${campoConIcono({ id: 'recuperar-correo', nombre: 'correo', etiqueta: 'Correo electrónico', tipo: 'email', iconoNombre: 'sobre', autocompletar: 'email' })}
          <div class="captcha">
            <p class="captcha__titulo">Demuestra que no eres un robot</p>
            <div class="captcha__fila">
              <img class="captcha__imagen" alt="Imagen con letras para comprobar que eres humano" width="220" height="70" data-captcha-imagen>
              <button class="captcha__otra" type="button" data-accion="otro-captcha" aria-label="Mostrar otras letras">↻</button>
            </div>
          </div>
          ${campoConIcono({ id: 'recuperar-captcha', nombre: 'captchaRespuesta', etiqueta: 'Escribe las letras de la imagen', tipo: 'text', iconoNombre: 'huella', autocompletar: 'off' })}
          ${campoConIcono({ id: 'recuperar-codigo', nombre: 'codigoGrupo', etiqueta: 'Código de tu clase', tipo: 'text', iconoNombre: 'estudiantesTrazo', autocompletar: 'off' })}
          <p class="captcha__ayuda">Es el mismo código que te dio tu docente para unirte a la clase.</p>
          <p class="mensaje-error" role="alert" data-mensaje-general></p>
          <button class="boton-principal" type="submit">Continuar</button>
        </form>`
    })

    const formulario = contenedor.querySelector('form')
    const boton = formulario.querySelector('button[type="submit"]')
    const imagen = formulario.querySelector('[data-captcha-imagen]')
    const mostrarErrores = prepararFormulario(formulario)
    formulario.elements.captchaRespuesta.setAttribute('autocapitalize', 'characters')
    formulario.elements.captchaRespuesta.setAttribute('spellcheck', 'false')
    formulario.elements.codigoGrupo.setAttribute('autocapitalize', 'characters')
    let captchaId = null

    async function cargarCaptcha () {
      captchaId = null
      imagen.removeAttribute('src')
      formulario.elements.captchaRespuesta.value = ''
      try {
        const captcha = await autenticacion.pedirCaptcha()
        if (!contenedor.isConnected) return
        captchaId = captcha.captchaId
        imagen.src = captcha.imagen
      } catch (error) {
        if (contenedor.isConnected) mostrarErrores({}, obtenerMensajeError(error))
      }
    }

    formulario.querySelector('[data-accion="otro-captcha"]').addEventListener('click', cargarCaptcha)
    cargarCaptcha()

    formulario.addEventListener('submit', async (evento) => {
      evento.preventDefault()
      const elementos = formulario.elements
      const datos = {
        correo: elementos.correo.value.trim().toLowerCase(),
        captchaRespuesta: elementos.captchaRespuesta.value.trim(),
        codigoGrupo: elementos.codigoGrupo.value.trim()
      }
      const errores = validarPasoVerificacion(datos)
      mostrarErrores(errores)
      if (Object.keys(errores).length > 0) return
      if (!captchaId) {
        mostrarErrores({}, 'Espera a que cargue la imagen o pide otra.')
        return
      }

      boton.disabled = true
      boton.textContent = 'Verificando…'
      try {
        const { tokenRecuperacion, nombre } = await autenticacion.verificarRecuperacion({ ...datos, captchaId })
        if (contenedor.isConnected) pasoContrasena({ tokenRecuperacion, nombre })
      } catch (error) {
        if (!contenedor.isConnected) return
        mostrarErrores(agruparDetallesPorCampo(error), error.codigo === 'DATOS_INVALIDOS' ? '' : obtenerMensajeError(error))
        // Cada captcha sirve una sola vez: tras un intento fallido se muestra otro
        cargarCaptcha()
        boton.disabled = false
        boton.textContent = 'Continuar'
      }
    })
  }

  // ---------- Paso 2: contraseña nueva ----------
  function pasoContrasena ({ tokenRecuperacion, nombre }) {
    pintar({
      titulo: `¡Hola, ${nombre}!`,
      subtitulo: 'Paso 2 de 2 · Escribe tu nueva contraseña',
      contenido: html`
        <form class="pantalla-acceso__formulario" novalidate>
          ${campoConIcono({ id: 'recuperar-nueva', nombre: 'contrasenaNueva', etiqueta: 'Nueva contraseña', tipo: 'password', iconoNombre: 'candado', autocompletar: 'new-password' })}
          ${campoConIcono({ id: 'recuperar-confirmacion', nombre: 'confirmacion', etiqueta: 'Confirmar nueva contraseña', tipo: 'password', iconoNombre: 'candado', autocompletar: 'new-password' })}
          <p class="mensaje-error" role="alert" data-mensaje-general></p>
          <button class="boton-principal" type="submit">Guardar contraseña</button>
        </form>`
    })

    const formulario = contenedor.querySelector('form')
    const boton = formulario.querySelector('button[type="submit"]')
    const mostrarErrores = prepararFormulario(formulario)
    formulario.elements.contrasenaNueva.focus()

    formulario.addEventListener('submit', async (evento) => {
      evento.preventDefault()
      const datos = {
        contrasenaNueva: formulario.elements.contrasenaNueva.value,
        confirmacion: formulario.elements.confirmacion.value
      }
      const errores = validarPasoContrasena(datos)
      mostrarErrores(errores)
      if (Object.keys(errores).length > 0) return

      boton.disabled = true
      boton.textContent = 'Guardando…'
      try {
        await autenticacion.cambiarContrasenaOlvidada({ tokenRecuperacion, contrasenaNueva: datos.contrasenaNueva })
        if (contenedor.isConnected) pasoListo()
      } catch (error) {
        if (!contenedor.isConnected) return
        if (error.codigo === 'RECUPERACION_VENCIDA') {
          pasoVerificacion()
          contenedor.querySelector('[data-mensaje-general]').textContent = obtenerMensajeError(error)
          return
        }
        mostrarErrores(agruparDetallesPorCampo(error), error.codigo === 'DATOS_INVALIDOS' ? '' : obtenerMensajeError(error))
        boton.disabled = false
        boton.textContent = 'Guardar contraseña'
      }
    })
  }

  // ---------- Listo ----------
  function pasoListo () {
    pintar({
      titulo: '¡Contraseña cambiada!',
      subtitulo: 'Ya puedes iniciar sesión con tu nueva contraseña.',
      variante: 'saludo',
      contenido: html`<button class="boton-principal" type="button" data-accion="ir-ingreso">Iniciar sesión</button>`
    })
    contenedor.querySelector('[data-accion="ir-ingreso"]').addEventListener('click', () => navegar('/ingreso', { reemplazar: true }))
  }

  pasoVerificacion()
}
