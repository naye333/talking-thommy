// Ingreso con correo y contraseña contra POST /api/auth/ingreso (común a docentes y estudiantes).
import { html, renderizar } from '../../../nucleo/dom.js'
import { obtenerMensajeError, agruparDetallesPorCampo } from '../../../nucleo/mensajesError.js'
import { plantillaPantalla } from '../../../componentes/estructura.js'
import { mascota } from '../../../componentes/elementos.js'

// Misma regla que el backend (validacionesAutenticacion.js)
const EXPRESION_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validarFormularioIngreso ({ correo, contrasena }) {
  const errores = {}
  if (!correo) errores.correo = 'Escribe tu correo.'
  else if (!EXPRESION_CORREO.test(correo)) errores.correo = 'Correo no válido.'
  if (!contrasena) errores.contrasena = 'Escribe tu contraseña.'
  return errores
}

function campo ({ id, nombre, etiqueta, tipo, placeholder, autocompletar }) {
  return html`
    <div class="campo">
      <label class="campo__etiqueta" for="${id}">${etiqueta}</label>
      <input class="campo__entrada" id="${id}" name="${nombre}" type="${tipo}" placeholder="${placeholder}"
             autocomplete="${autocompletar}" aria-describedby="${id}-error">
      <p class="campo__error" id="${id}-error" data-error-de="${nombre}"></p>
    </div>`
}

export function pantallaIngreso ({ contenedor, navegar }, app) {
  renderizar(contenedor, plantillaPantalla({
    clase: 'pantalla--sin-navegacion pantalla-ingreso',
    contenido: html`
      ${mascota({ variante: 'docente', clase: 'pantalla-ingreso__mascota' })}
      <div class="pantalla-ingreso__textos">
        <h1 class="pantalla-ingreso__titulo">Talking Thommy</h1>
        <p class="pantalla-ingreso__subtitulo">Practica inglés con Thommy, tu tutor con IA</p>
      </div>
      <form class="pantalla-ingreso__formulario" novalidate>
        ${campo({ id: 'ingreso-correo', nombre: 'correo', etiqueta: 'Correo electrónico', tipo: 'email', placeholder: 'tu@correo.com', autocompletar: 'email' })}
        ${campo({ id: 'ingreso-contrasena', nombre: 'contrasena', etiqueta: 'Contraseña', tipo: 'password', placeholder: 'Tu contraseña', autocompletar: 'current-password' })}
        <p class="mensaje-error" role="alert" data-mensaje-general></p>
        <button class="boton-principal" type="submit">Iniciar sesión</button>
      </form>`
  }))

  const formulario = contenedor.querySelector('form')
  const boton = formulario.querySelector('button[type="submit"]')
  const mensajeGeneral = formulario.querySelector('[data-mensaje-general]')

  function mostrarErrores (porCampo, general = '') {
    for (const parrafo of formulario.querySelectorAll('[data-error-de]')) {
      const nombre = parrafo.dataset.errorDe
      parrafo.textContent = porCampo[nombre] || ''
      formulario.elements[nombre].setAttribute('aria-invalid', porCampo[nombre] ? 'true' : 'false')
    }
    mensajeGeneral.textContent = general
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    const datos = {
      correo: formulario.elements.correo.value.trim().toLowerCase(),
      contrasena: formulario.elements.contrasena.value
    }
    const errores = validarFormularioIngreso(datos)
    mostrarErrores(errores)
    if (Object.keys(errores).length > 0) return

    boton.disabled = true
    boton.textContent = 'Ingresando…'
    try {
      const { token, usuario } = await app.servicios.autenticacion.ingresar(datos)
      app.sesion.guardar({ token, usuario })
      navegar(app.rutaInicio(), { reemplazar: true })
    } catch (error) {
      if (!contenedor.isConnected) return
      mostrarErrores(agruparDetallesPorCampo(error), error.codigo === 'DATOS_INVALIDOS' ? '' : obtenerMensajeError(error))
      boton.disabled = false
      boton.textContent = 'Iniciar sesión'
    }
  })
}
