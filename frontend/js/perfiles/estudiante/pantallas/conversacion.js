// Conversación con Thommy: el estudiante toca el micrófono, habla, y recibe transcripción,
// retroalimentación de pronunciación y la siguiente intervención del tutor.
// Estados: listo → escuchando → procesando → resultado → listo
import { html, renderizar } from '../../../nucleo/dom.js'
import { obtenerMensajeError } from '../../../nucleo/mensajesError.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { mascota, botonPrincipal, avisoDatosEjemplo } from '../../../componentes/elementos.js'
import { estadoCargando, estadoError } from '../../../componentes/estados.js'
import { icono } from '../../../componentes/iconos.js'
import { crearGrabadora } from '../../../servicios/estudiante/grabadora.js'
import { hablar, callar, vozDisponible } from '../../../servicios/estudiante/voz.js'
import { RUTAS_ESTUDIANTE } from '../navegacion.js'

const BARRAS_ONDA = 28
const DURACION_MAXIMA_MS = 30000

function ondaDecorativa (clase) {
  return html`<span class="onda ${clase}" aria-hidden="true">${Array.from({ length: 7 }, (_, indice) => html`<i style="--i: ${indice}"></i>`)}</span>`
}

function mensajeThommy ({ texto, frase }) {
  const lectura = frase ? `${texto} ${frase}` : texto
  return html`
    <li class="mensaje mensaje--thommy">
      <p class="mensaje__texto" lang="en">${texto}</p>
      ${frase ? html`<p class="mensaje__frase" lang="en">“${frase}”</p>` : ''}
      ${vozDisponible()
        ? html`<button class="mensaje__escuchar" type="button" data-accion="escuchar" data-texto="${lectura}" aria-label="Escuchar a Thommy">${icono('volumen')}</button>`
        : ''}
    </li>`
}

function mensajeEstudiante ({ transcripcion, evaluacion }) {
  return html`
    <li class="mensaje mensaje--estudiante">
      <p class="mensaje__texto" lang="en">${transcripcion}</p>
      <span class="mensaje__puntaje mensaje__puntaje--${evaluacion.nivel}">${evaluacion.puntaje}%</span>
    </li>`
}

function palabrasEvaluadas (palabras) {
  return html`
    <p class="palabras" lang="en">
      ${palabras.map((palabra) => html`<span class="palabras__palabra${palabra.correcta ? '' : ' palabras__palabra--mejorar'}">${palabra.texto}</span> `)}
    </p>`
}

function contenidoResultado ({ transcripcion, evaluacion }) {
  const esExcelente = evaluacion.nivel === 'excelente'
  const porMejorar = evaluacion.palabras.filter((palabra) => !palabra.correcta)
  return html`
    <div class="resultado__insignia${esExcelente ? '' : ' resultado__insignia--practicar'}">
      ${icono(esExcelente ? 'check' : 'estrella', { clase: 'resultado__icono' })}
      ${icono('chispa', { clase: 'resultado__chispa resultado__chispa--1' })}
      ${icono('chispa', { clase: 'resultado__chispa resultado__chispa--2' })}
      ${icono('chispa', { clase: 'resultado__chispa resultado__chispa--3' })}
    </div>
    <h2 class="resultado__titulo" id="titulo-resultado">${esExcelente ? '¡Buen trabajo!' : '¡Casi lo logras!'}</h2>
    <p class="resultado__mensaje">${evaluacion.mensaje}</p>
    <section class="tarjeta resultado__detalle">
      ${icono('estrella', { clase: 'resultado__estrella' })}
      <div>
        <p class="resultado__detalle-titulo">${esExcelente ? '¡Sigue practicando!' : 'Palabras para practicar'}</p>
        ${palabrasEvaluadas(evaluacion.palabras)}
        ${porMejorar.map((palabra) => palabra.sugerencia ? html`<p class="resultado__sugerencia">${palabra.sugerencia}</p>` : '')}
        <p class="resultado__puntaje">Pronunciación: <strong>${evaluacion.puntaje}%</strong></p>
      </div>
    </section>
    ${botonPrincipal({ texto: 'Continuar', conFlecha: true, accion: 'continuar' })}
    <p class="solo-lectores">Dijiste: ${transcripcion}</p>`
}

export async function pantallaConversacion ({ contenedor, query }, app) {
  const servicio = app.servicios.conversacion
  let sesion = null
  let grabadora = null
  let animacion = null
  let limiteTurno = null
  let resultadoPendiente = null
  let estaActiva = true

  renderizar(contenedor, plantillaPantalla({
    clase: 'pantalla--sin-navegacion conversacion',
    cabecera: encabezado({ titulo: 'Conversación', rutaAtras: RUTAS_ESTUDIANTE.inicio }),
    contenido: html`<div class="conversacion__cuerpo" data-region="conversacion">${estadoCargando('Preparando a Thommy…')}</div>`
  }))
  const region = contenedor.querySelector('[data-region="conversacion"]')

  function liberarGrabacion () {
    cancelAnimationFrame(animacion)
    clearTimeout(limiteTurno)
    grabadora?.liberar()
    grabadora = null
  }

  function limpiar () {
    estaActiva = false
    liberarGrabacion()
    sesion?.cerrar()
    callar()
  }

  async function iniciar () {
    renderizar(region, estadoCargando('Preparando a Thommy…'))
    try {
      const tema = query.tema ? await app.servicios.syllabus.consultarTema(query.tema) : null
      sesion = await servicio.iniciar({ tema })
      if (!estaActiva) return sesion.cerrar()
      mostrarConversacion(tema)
    } catch (error) {
      if (!estaActiva) return
      renderizar(region, estadoError(obtenerMensajeError(error), { conReintento: error.estado !== 404 }))
      region.querySelector('[data-accion="reintentar"]')?.addEventListener('click', iniciar, { once: true })
    }
  }

  function mostrarConversacion (tema) {
    renderizar(region, html`
      <a class="conversacion__tema" href="#${tema ? RUTAS_ESTUDIANTE.tema(tema.id) : RUTAS_ESTUDIANTE.lecciones}">
        ${icono('libroAbierto')}<span>${tema ? tema.titulo : 'Conversación libre · elige un tema'}</span>
      </a>
      <div class="conversacion__escena">${mascota({ variante: 'conversacion', clase: 'conversacion__mascota' })}</div>
      <ol class="conversacion__mensajes" data-region="mensajes" aria-live="polite">${mensajeThommy(sesion.saludo)}</ol>
      <p class="mensaje-error" role="alert" data-region="aviso"></p>
      ${avisoDatosEjemplo({ visible: servicio.capacidades.datosEjemplo })}

      <div class="conversacion__controles">
        ${ondaDecorativa('onda--izquierda')}
        <button class="boton-microfono" type="button" data-accion="hablar" aria-label="Toca para hablar">${icono('microfono')}</button>
        ${ondaDecorativa('onda--derecha')}
        <p class="conversacion__indicacion">Toca para hablar</p>
        <a class="conversacion__salir" href="#${RUTAS_ESTUDIANTE.inicio}" aria-label="Terminar conversación">${icono('cerrar')}</a>
      </div>

      <section class="capa capa--escuchando" data-capa="escuchando" role="dialog" aria-modal="true" aria-labelledby="titulo-escuchando" hidden>
        <h2 class="capa__titulo" id="titulo-escuchando">Escuchando…</h2>
        <button class="anillo-escucha" type="button" data-accion="terminar-turno" aria-label="Terminar y enviar">
          <span class="anillo-escucha__pulso" aria-hidden="true"></span>
          ${icono('microfono', { clase: 'anillo-escucha__icono' })}
        </button>
        <p class="capa__texto">Habla con claridad</p>
        <p class="capa__ayuda">Toca el micrófono cuando termines</p>
        <div class="onda-viva" aria-hidden="true">${Array.from({ length: BARRAS_ONDA }, () => html`<i></i>`)}</div>
        <button class="boton-contorno" type="button" data-accion="cancelar-turno">Cancelar</button>
      </section>

      <section class="capa capa--procesando" data-capa="procesando" role="status" hidden>
        ${estadoCargando('Thommy está analizando tu pronunciación…')}
      </section>

      <section class="capa capa--resultado" data-capa="resultado" role="dialog" aria-modal="true" aria-labelledby="titulo-resultado" hidden>
        <div class="resultado" data-region="resultado"></div>
      </section>`)
    region.addEventListener('click', alHacerClic)
  }

  const capa = (nombre) => region.querySelector(`[data-capa="${nombre}"]`)
  const aviso = (texto) => { region.querySelector('[data-region="aviso"]').textContent = texto }

  function mostrarCapa (nombre) {
    for (const elemento of region.querySelectorAll('[data-capa]')) elemento.hidden = elemento.dataset.capa !== nombre
    const enfocable = nombre && capa(nombre).querySelector('button')
    if (enfocable) enfocable.focus()
  }

  function animarOnda () {
    const barras = [...region.querySelectorAll('.onda-viva i')]
    const historial = new Array(barras.length).fill(0.08)
    const pintar = () => {
      if (!grabadora) return
      historial.shift()
      historial.push(Math.max(0.08, grabadora.nivel()))
      barras.forEach((barra, indice) => { barra.style.transform = `scaleY(${historial[indice]})` })
      animacion = requestAnimationFrame(pintar)
    }
    pintar()
  }

  async function empezarTurno () {
    aviso('')
    callar()
    try {
      grabadora = await crearGrabadora({ alRecibirTrozo: (trozo) => sesion.enviarTrozo(trozo) })
    } catch (error) {
      aviso(obtenerMensajeError(error))
      return
    }
    if (!estaActiva) return liberarGrabacion()
    sesion.iniciarTurno()
    grabadora.iniciar()
    mostrarCapa('escuchando')
    animarOnda()
    limiteTurno = setTimeout(terminarTurno, DURACION_MAXIMA_MS)
  }

  async function terminarTurno () {
    if (!grabadora) return
    clearTimeout(limiteTurno)
    await grabadora.detener()
    liberarGrabacion()
    mostrarCapa('procesando')
    try {
      resultadoPendiente = await sesion.finalizarTurno()
      if (!estaActiva) return
      renderizar(region.querySelector('[data-region="resultado"]'), contenidoResultado(resultadoPendiente))
      mostrarCapa('resultado')
    } catch (error) {
      if (!estaActiva) return
      mostrarCapa(null)
      aviso(obtenerMensajeError(error))
      region.querySelector('[data-accion="hablar"]').focus()
    }
  }

  function cancelarTurno () {
    liberarGrabacion()
    sesion.cancelarTurno()
    mostrarCapa(null)
    region.querySelector('[data-accion="hablar"]').focus()
  }

  function continuar () {
    const lista = region.querySelector('[data-region="mensajes"]')
    lista.insertAdjacentHTML('beforeend', mensajeEstudiante(resultadoPendiente).texto + mensajeThommy(resultadoPendiente.respuesta).texto)
    resultadoPendiente = null
    mostrarCapa(null)
    lista.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' })
    region.querySelector('[data-accion="hablar"]').focus()
  }

  function alHacerClic (evento) {
    const boton = evento.target.closest('[data-accion]')
    if (!boton) return
    const acciones = {
      hablar: empezarTurno,
      'terminar-turno': terminarTurno,
      'cancelar-turno': cancelarTurno,
      continuar,
      escuchar: () => hablar(boton.dataset.texto)
    }
    acciones[boton.dataset.accion]?.()
  }

  iniciar()
  return limpiar
}
