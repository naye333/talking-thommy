// Piezas de los formularios de ingreso y registro.
import { html } from '../../nucleo/dom.js'
import { icono } from '../../componentes/iconos.js'

// Misma regla que el backend (validacionesAutenticacion.js)
export const EXPRESION_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_CONTRASENA = 8
export const MAX_CONTRASENA = 72

// Campo con icono a la izquierda; las contraseñas tienen botón para mostrar u ocultar
export function campoConIcono ({ id, nombre, etiqueta, tipo, iconoNombre, autocompletar }) {
  const esContrasena = tipo === 'password'
  return html`
    <div class="campo">
      <div class="campo-icono">
        ${icono(iconoNombre, { clase: 'campo-icono__icono' })}
        <input class="campo-icono__entrada" id="${id}" name="${nombre}" type="${tipo}" placeholder="${etiqueta}"
               aria-label="${etiqueta}" autocomplete="${autocompletar}" aria-describedby="${id}-error">
        ${esContrasena
          ? html`<button class="campo-icono__ver" type="button" data-accion="ver-contrasena" aria-label="Mostrar contraseña" aria-pressed="false">${icono('ojoTachado')}</button>`
          : ''}
      </div>
      <p class="campo__error" id="${id}-error" data-error-de="${nombre}"></p>
    </div>`
}

// Conecta los botones de mostrar contraseña y devuelve una función para pintar errores por campo
export function prepararFormulario (formulario) {
  formulario.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-accion="ver-contrasena"]')
    if (!boton) return
    const entrada = boton.parentElement.querySelector('input')
    const visible = entrada.type === 'password'
    entrada.type = visible ? 'text' : 'password'
    boton.setAttribute('aria-pressed', String(visible))
    boton.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña')
    boton.innerHTML = icono(visible ? 'ojo' : 'ojoTachado').texto
  })

  const mensajeGeneral = formulario.querySelector('[data-mensaje-general]')
  return function mostrarErrores (porCampo, general = '') {
    for (const parrafo of formulario.querySelectorAll('[data-error-de]')) {
      const nombre = parrafo.dataset.errorDe
      parrafo.textContent = porCampo[nombre] || ''
      // Los grupos de opciones (radio) devuelven una lista: se marca cada opción
      const campo = formulario.elements[nombre]
      const campos = campo instanceof Element ? [campo] : [...(campo || [])]
      for (const elemento of campos) elemento.setAttribute('aria-invalid', porCampo[nombre] ? 'true' : 'false')
    }
    if (mensajeGeneral) mensajeGeneral.textContent = general
  }
}

export function marcaTalkingThommy () {
  return html`
    <h1 class="marca">
      <span class="marca__linea">Talking</span>
      <span class="marca__linea marca__linea--lima">Thommy</span>
    </h1>`
}
