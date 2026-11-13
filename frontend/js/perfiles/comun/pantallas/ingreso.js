// Ingreso con correo y contraseña contra POST /api/auth/ingreso (común a docentes y estudiantes).
import { html, renderizar } from '../../../nucleo/dom.js'
import { obtenerMensajeError, agruparDetallesPorCampo } from '../../../nucleo/mensajesError.js'
import { plantillaPantalla } from '../../../componentes/estructura.js'
import { mascota } from '../../../componentes/elementos.js'
import { campoConIcono, prepararFormulario, EXPRESION_CORREO } from '../formularios.js'

export function validarFormularioIngreso ({ correo, contrasena }) {
  const errores = {}
  if (!correo) errores.correo = 'Escribe tu correo.'
  else if (!EXPRESION_CORREO.test(correo)) errores.correo = 'Correo no válido.'
  if (!contrasena) errores.contrasena = 'Escribe tu contraseña.'
  return errores
}

export function pantallaIngreso ({ contenedor, navegar }, app) {
  renderizar(contenedor, plantillaPantalla({
    clase: 'pantalla--sin-navegacion pantalla-acceso',
    contenido: html`
      ${mascota({ variante: 'bienvenida', clase: 'pantalla-acceso__mascota' })}
      <div class="pantalla-acceso__textos">
        <h1 class="pantalla-acceso__titulo">¡Bienvenido de nuevo!</h1>
        <p class="pantalla-acceso__subtitulo">Inicia sesión para continuar</p>
      </div>
      <form class="pantalla-acceso__formulario" novalidate>
        ${campoConIcono({ id: 'ingreso-correo', nombre: 'correo', etiqueta: 'Correo electrónico', tipo: 'email', iconoNombre: 'sobre', autocompletar: 'email' })}
        ${campoConIcono({ id: 'ingreso-contrasena', nombre: 'contrasena', etiqueta: 'Contraseña', tipo: 'password', iconoNombre: 'candado', autocompletar: 'current-password' })}
        <p class="mensaje-error" role="alert" data-mensaje-general></p>
        <button class="boton-principal" type="submit">Iniciar sesión</button>
      </form>
      <p class="pantalla-acceso__alterno">¿No tienes cuenta? <a href="#/registro">Regístrate</a></p>`
  }))

  const formulario = contenedor.querySelector('form')
  const boton = formulario.querySelector('button[type="submit"]')
  const mostrarErrores = prepararFormulario(formulario)

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
