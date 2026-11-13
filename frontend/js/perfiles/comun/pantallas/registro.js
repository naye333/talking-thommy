// Registro de estudiantes contra POST /api/auth/registro. El backend solo crea estudiantes.
import { html, renderizar } from '../../../nucleo/dom.js'
import { obtenerMensajeError, agruparDetallesPorCampo } from '../../../nucleo/mensajesError.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { mascota } from '../../../componentes/elementos.js'
import { campoConIcono, prepararFormulario, EXPRESION_CORREO, MIN_CONTRASENA, MAX_CONTRASENA } from '../formularios.js'

export function validarFormularioRegistro ({ nombre, correo, contrasena, confirmacion, nivel }) {
  const errores = {}
  if (!nombre) errores.nombre = 'Escribe tu nombre completo.'
  else if (nombre.length > 100) errores.nombre = 'Máximo 100 caracteres.'
  if (!EXPRESION_CORREO.test(correo)) errores.correo = 'Correo no válido.'
  if (contrasena.length < MIN_CONTRASENA) errores.contrasena = `Mínimo ${MIN_CONTRASENA} caracteres.`
  else if (contrasena.length > MAX_CONTRASENA) errores.contrasena = `Máximo ${MAX_CONTRASENA} caracteres.`
  if (confirmacion !== contrasena) errores.confirmacion = 'Las contraseñas no coinciden.'
  if (![1, 2].includes(nivel)) errores.nivel = 'Elige tu curso.'
  return errores
}

export function pantallaRegistro ({ contenedor, navegar }, app) {
  renderizar(contenedor, plantillaPantalla({
    clase: 'pantalla--sin-navegacion pantalla-acceso pantalla-acceso--registro',
    cabecera: encabezado({ titulo: '', rutaAtras: '/ingreso' }),
    contenido: html`
      ${mascota({ variante: 'bienvenida', clase: 'pantalla-acceso__mascota' })}
      <div class="pantalla-acceso__textos">
        <h1 class="pantalla-acceso__titulo">Crea tu cuenta</h1>
        <p class="pantalla-acceso__subtitulo">¡Empecemos a aprender juntos!</p>
      </div>
      <form class="pantalla-acceso__formulario" novalidate>
        ${campoConIcono({ id: 'registro-nombre', nombre: 'nombre', etiqueta: 'Nombre completo', tipo: 'text', iconoNombre: 'persona', autocompletar: 'name' })}
        ${campoConIcono({ id: 'registro-correo', nombre: 'correo', etiqueta: 'Correo electrónico', tipo: 'email', iconoNombre: 'sobre', autocompletar: 'email' })}
        ${campoConIcono({ id: 'registro-contrasena', nombre: 'contrasena', etiqueta: 'Contraseña', tipo: 'password', iconoNombre: 'candado', autocompletar: 'new-password' })}
        ${campoConIcono({ id: 'registro-confirmacion', nombre: 'confirmacion', etiqueta: 'Confirmar contraseña', tipo: 'password', iconoNombre: 'candado', autocompletar: 'new-password' })}
        <fieldset class="selector-nivel">
          <legend class="selector-nivel__titulo">¿Qué curso estás viendo?</legend>
          <label class="selector-nivel__opcion"><input type="radio" name="nivel" value="1"><span>Inglés I</span></label>
          <label class="selector-nivel__opcion"><input type="radio" name="nivel" value="2"><span>Inglés II</span></label>
          <p class="campo__error" data-error-de="nivel"></p>
        </fieldset>
        <p class="mensaje-error" role="alert" data-mensaje-general></p>
        <button class="boton-principal" type="submit">Registrarme</button>
      </form>
      <p class="pantalla-acceso__alterno">¿Ya tienes cuenta? <a href="#/ingreso">Inicia sesión</a></p>`
  }))

  const formulario = contenedor.querySelector('form')
  const boton = formulario.querySelector('button[type="submit"]')
  const mostrarErrores = prepararFormulario(formulario)

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    const elementos = formulario.elements
    const datos = {
      nombre: elementos.nombre.value.trim(),
      correo: elementos.correo.value.trim().toLowerCase(),
      contrasena: elementos.contrasena.value,
      confirmacion: elementos.confirmacion.value,
      nivel: Number(elementos.nivel.value)
    }
    const errores = validarFormularioRegistro(datos)
    mostrarErrores(errores)
    if (Object.keys(errores).length > 0) return

    boton.disabled = true
    boton.textContent = 'Creando tu cuenta…'
    try {
      const { confirmacion, ...cuerpo } = datos
      const { token, usuario } = await app.servicios.autenticacion.registrar(cuerpo)
      app.sesion.guardar({ token, usuario })
      navegar(app.rutaInicio(), { reemplazar: true })
    } catch (error) {
      if (!contenedor.isConnected) return
      mostrarErrores(agruparDetallesPorCampo(error), error.codigo === 'DATOS_INVALIDOS' ? '' : obtenerMensajeError(error))
      boton.disabled = false
      boton.textContent = 'Registrarme'
    }
  })
}
