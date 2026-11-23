// Conversación con Thommy: el estudiante mantiene presionado el micrófono mientras habla (como una nota
// de voz) y al soltarlo se envía. Thommy responde en el chat y habla solo, sin tocar ningún botón.
// Estados del micrófono: libre → iniciando → grabando → enviando → libre
import { html, renderizar } from '../../../nucleo/dom.js'
import { obtenerMensajeError } from '../../../nucleo/mensajesError.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { mascota, botonPrincipal, avisoDatosEjemplo } from '../../../componentes/elementos.js'
import { estadoCargando, estadoError } from '../../../componentes/estados.js'
import { icono } from '../../../componentes/iconos.js'
import { crearGrabadora } from '../../../servicios/estudiante/grabadora.js'
import { escucharThommy, callar, puedeEscuchar } from '../../../servicios/estudiante/voz.js'
import { crearControlPulsacion } from '../../../servicios/estudiante/pulsarParaHablar.js'
import { RUTAS_ESTUDIANTE } from '../navegacion.js'

const BARRAS_ONDA = 28
const DURACION_MAXIMA_MS = 30000
const INDICACION_LIBRE = 'Mantén presionado para hablar'

function ondaDecorativa (clase) {
  return html`<span class="onda ${clase}" aria-hidden="true">${Array.from({ length: 7 }, (_, indice) => html`<i style="--i: ${indice}"></i>`)}</span>`
}

// audioUrl: voz de Thommy generada en el servidor; si falta, se usa la voz del dispositivo
function mensajeThommy ({ texto, frase, audioUrl }, urlBase) {
  const lectura = frase ? `${texto} ${frase}` : texto
  return html`
    <li class="mensaje mensaje--thommy">
      <p class="mensaje__texto" lang="en">${texto}</p>
      ${frase ? html`<p class="mensaje__frase" lang="en">“${frase}”</p>` : ''}
      ${puedeEscuchar({ texto: lectura, audioUrl, urlBase })
        ? html`<button class="mensaje__escuchar" type="button" data-accion="escuchar" data-texto="${lectura}" data-audio-url="${audioUrl || ''}" aria-label="Volver a escuchar a Thommy">${icono('volumen')}</button>`
        : ''}
    </li>`
}

// El puntaje es un botón: abre el detalle de pronunciación de ese turno
function mensajeEstudiante ({ transcripcion, evaluacion }, indice) {
  return html`
    <li class="mensaje mensaje--estudiante">
      <p class="mensaje__texto" lang="en">${transcripcion}</p>
      <button class="mensaje__puntaje mensaje__puntaje--${evaluacion.nivel}" type="button" data-accion="ver-resultado" data-indice="${indice}" aria-label="Ver detalle: ${evaluacion.puntaje}%">${evaluacion.puntaje}%</button>
    </li>`
}

function mensajePensando () {
  return html`
    <li class="mensaje mensaje--thommy mensaje--pensando" data-region="pensando" aria-label="Thommy está pensando">
      <span class="puntos" aria-hidden="true"><i></i><i></i><i></i></span>
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
    ${botonPrincipal({ texto: 'Seguir conversando', conFlecha: true, accion: 'cerrar-resultado' })}
    <p class="solo-lectores">Dijiste: ${transcripcion}</p>`
}

export async function pantallaConversacion ({ contenedor, query }, app) {
  const servicio = app.servicios.conversacion
  const urlBase = app.configuracion.urlApi
  const resultados = []
  let sesion = null
  let grabadora = null
  let animacion = null
  let limiteTurno = null
  let control = null
  let estaActiva = true

  renderizar(contenedor, plantillaPantalla({
    clase: 'pantalla--sin-navegacion conversacion',
    cabecera: encabezado({ titulo: 'Conversación', rutaAtras: RUTAS_ESTUDIANTE.inicio }),
    contenido: html`<div class="conversacion__cuerpo" data-region="conversacion">${estadoCargando('Preparando a Thommy…')}</div>`
  }))
  const region = contenedor.querySelector('[data-region="conversacion"]')
  const buscar = (selector) => region.querySelector(selector)

  function liberarGrabacion () {
    cancelAnimationFrame(animacion)
    clearTimeout(limiteTurno)
    grabadora?.liberar()
    grabadora = null
  }

  function limpiar () {
    estaActiva = false
    control?.descartar()
    liberarGrabacion()
    sesion?.cerrar()
    callar()
  }

  // Thommy habla solo: con el audio de Piper o, si no hay, con la voz del dispositivo
  function hablarThommy (mensaje) {
    if (!estaActiva) return
    escucharThommy({ texto: mensaje.frase ? `${mensaje.texto} ${mensaje.frase}` : mensaje.texto, audioUrl: mensaje.audioUrl, urlBase })
  }

  async function iniciar () {
    renderizar(region, estadoCargando('Preparando a Thommy…'))
    try {
      const tema = query.tema ? await app.servicios.syllabus.consultarTema(query.tema) : null
      sesion = await servicio.iniciar({ tema })
      if (!estaActiva) return sesion.cerrar()
      mostrarConversacion(tema)
      hablarThommy(sesion.saludo)
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
      <ol class="conversacion__mensajes" data-region="mensajes" aria-live="polite">${mensajeThommy(sesion.saludo, urlBase)}</ol>
      <p class="mensaje-error" role="alert" data-region="aviso"></p>
      ${avisoDatosEjemplo({ visible: servicio.capacidades.datosEjemplo })}

      <div class="conversacion__controles" data-region="controles">
        <div class="escucha" data-region="escucha" hidden>
          <span class="escucha__punto" aria-hidden="true"></span>
          <span>Escuchando…</span>
          <div class="onda-viva onda-viva--compacta" aria-hidden="true">${Array.from({ length: BARRAS_ONDA }, () => html`<i></i>`)}</div>
        </div>
        ${ondaDecorativa('onda--izquierda')}
        <button class="boton-microfono" type="button" data-accion="hablar" aria-label="${INDICACION_LIBRE}">${icono('microfono')}</button>
        ${ondaDecorativa('onda--derecha')}
        <p class="conversacion__indicacion" data-region="indicacion">${INDICACION_LIBRE}</p>
        <a class="conversacion__salir" href="#${RUTAS_ESTUDIANTE.inicio}" aria-label="Terminar conversación">${icono('cerrar')}</a>
      </div>

      <section class="capa capa--resultado" data-capa="resultado" role="dialog" aria-modal="true" aria-labelledby="titulo-resultado" hidden>
        <div class="resultado" data-region="resultado"></div>
      </section>`)

    control = crearControlPulsacion({ empezar: empezarTurno, terminar: terminarTurno, cancelar: cancelarTurno })
    region.addEventListener('click', alHacerClic)
    conectarMicrofono(buscar('[data-accion="hablar"]'))
  }

  // Mantener presionado: funciona con dedo, mouse y teclado (Espacio o Enter)
  function conectarMicrofono (boton) {
    boton.addEventListener('pointerdown', (evento) => {
      if (evento.button !== 0) return
      evento.preventDefault()
      // Aunque el dedo se mueva fuera del botón, el "soltar" llega al botón.
      // Algunos navegadores lo rechazan: no debe impedir que se grabe.
      try {
        boton.setPointerCapture?.(evento.pointerId)
      } catch { /* sin captura: el soltar igual llega si el dedo sigue sobre el botón */ }
      void control.presionar()
    })
    const soltar = () => { void control.soltar() }
    boton.addEventListener('pointerup', soltar)
    boton.addEventListener('pointercancel', soltar)
    boton.addEventListener('lostpointercapture', soltar)
    // Evita el menú de "copiar/guardar" del celular al mantener presionado
    boton.addEventListener('contextmenu', (evento) => evento.preventDefault())
    boton.addEventListener('keydown', (evento) => {
      if ((evento.key === ' ' || evento.key === 'Enter') && !evento.repeat) {
        evento.preventDefault()
        void control.presionar()
      }
    })
    boton.addEventListener('keyup', (evento) => {
      if (evento.key === ' ' || evento.key === 'Enter') {
        evento.preventDefault()
        soltar()
      }
    })
  }

  const aviso = (texto) => { buscar('[data-region="aviso"]').textContent = texto }
  const indicar = (texto) => { buscar('[data-region="indicacion"]').textContent = texto }

  function mostrarEscucha (visible) {
    buscar('[data-region="escucha"]').hidden = !visible
    buscar('[data-region="controles"]').classList.toggle('conversacion__controles--escuchando', visible)
    indicar(visible ? 'Suelta para enviar' : INDICACION_LIBRE)
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

  // Devuelve true si el micrófono quedó grabando
  async function empezarTurno () {
    aviso('')
    callar()
    try {
      grabadora = await crearGrabadora({ alRecibirTrozo: (trozo) => sesion.enviarTrozo(trozo) })
    } catch (error) {
      aviso(obtenerMensajeError(error))
      return false
    }
    if (!estaActiva) {
      liberarGrabacion()
      return false
    }
    // Si la conexión con el servidor se cayó, iniciarTurno lanza SIN_CONEXION: se apaga el micrófono y se avisa
    try {
      sesion.iniciarTurno()
      grabadora.iniciar()
    } catch (error) {
      liberarGrabacion()
      aviso(obtenerMensajeError(error))
      return false
    }
    mostrarEscucha(true)
    animarOnda()
    // Si se queda presionado demasiado, se envía solo
    limiteTurno = setTimeout(() => { void control.soltar() }, DURACION_MAXIMA_MS)
    return true
  }

  async function terminarTurno () {
    if (!grabadora) return
    clearTimeout(limiteTurno)
    await grabadora.detener()
    liberarGrabacion()
    mostrarEscucha(false)
    const lista = buscar('[data-region="mensajes"]')
    lista.insertAdjacentHTML('beforeend', mensajePensando().texto)
    lista.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' })
    indicar('Thommy está pensando…')
    try {
      const resultado = await sesion.finalizarTurno()
      if (!estaActiva) return
      buscar('[data-region="pensando"]')?.remove()
      resultados.push(resultado)
      lista.insertAdjacentHTML('beforeend', mensajeEstudiante(resultado, resultados.length - 1).texto + mensajeThommy(resultado.respuesta, urlBase).texto)
      lista.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' })
      hablarThommy(resultado.respuesta)
    } catch (error) {
      if (!estaActiva) return
      buscar('[data-region="pensando"]')?.remove()
      aviso(obtenerMensajeError(error))
    } finally {
      if (estaActiva) indicar(INDICACION_LIBRE)
    }
  }

  function cancelarTurno (motivo) {
    liberarGrabacion()
    sesion?.cancelarTurno()
    if (!estaActiva) return
    mostrarEscucha(false)
    if (motivo === 'corta') aviso('Mantén presionado el micrófono mientras hablas y suéltalo al terminar.')
  }

  function verResultado (indice) {
    const resultado = resultados[Number(indice)]
    if (!resultado) return
    callar()
    renderizar(buscar('[data-region="resultado"]'), contenidoResultado(resultado))
    const capa = buscar('[data-capa="resultado"]')
    capa.hidden = false
    capa.querySelector('button')?.focus()
  }

  function cerrarResultado () {
    buscar('[data-capa="resultado"]').hidden = true
    buscar('[data-accion="hablar"]').focus()
  }

  function alHacerClic (evento) {
    const boton = evento.target.closest('[data-accion]')
    if (!boton) return
    const acciones = {
      'ver-resultado': () => verResultado(boton.dataset.indice),
      'cerrar-resultado': cerrarResultado,
      escuchar: () => escucharThommy({ texto: boton.dataset.texto, audioUrl: boton.dataset.audioUrl, urlBase })
    }
    acciones[boton.dataset.accion]?.()
  }

  void iniciar()
  return limpiar
}
