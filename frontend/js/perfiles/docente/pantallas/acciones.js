// Acciones: el docente gestiona las sugerencias para reforzar y envía el reporte a los padres.
// Cada sugerencia se puede incluir o excluir del reporte; las escritas por el docente se pueden eliminar.
import { html, renderizar } from '../../../nucleo/dom.js'
import { obtenerMensajeError } from '../../../nucleo/mensajesError.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { mascota, botonPrincipal, avisoDatosEjemplo } from '../../../componentes/elementos.js'
import { cargarRegion, estadoVacio } from '../../../componentes/estados.js'
import { icono } from '../../../componentes/iconos.js'
import { MAX_LONGITUD_RECOMENDACION } from '../../../servicios/docente/servicioDocente.js'
import { navegacionDocente, RUTAS_DOCENTE } from '../navegacion.js'
import { seleccionEstudiante } from '../estado.js'

function filaRecomendacion (recomendacion) {
  const accion = recomendacion.incluida ? 'Quitar del reporte' : 'Incluir en el reporte'
  return html`
    <li class="sugerencia${recomendacion.incluida ? '' : ' sugerencia--excluida'}">
      <button class="sugerencia__casilla" type="button" role="checkbox" aria-checked="${String(recomendacion.incluida)}"
              data-accion="alternar" data-id="${recomendacion.id}" aria-label="${accion}: ${recomendacion.texto}">
        ${icono(recomendacion.incluida ? 'casillaMarcada' : 'casillaVacia')}
      </button>
      <span class="sugerencia__texto">- ${recomendacion.texto}</span>
      ${recomendacion.propia
        ? html`<button class="sugerencia__eliminar" type="button" data-accion="eliminar" data-id="${recomendacion.id}"
                       aria-label="Eliminar: ${recomendacion.texto}">${icono('papelera')}</button>`
        : ''}
    </li>`
}

function listaRecomendaciones (recomendaciones) {
  if (recomendaciones.length === 0) {
    return estadoVacio({ titulo: 'Sin sugerencias', texto: 'Agrega una sugerencia para este estudiante.' })
  }
  const incluidas = recomendaciones.filter((recomendacion) => recomendacion.incluida).length
  return html`
    <ul class="sugerencias__lista">${recomendaciones.map(filaRecomendacion)}</ul>
    <p class="sugerencias__resumen">${incluidas} de ${recomendaciones.length} incluidas en el reporte</p>`
}

export function pantallaAcciones ({ contenedor, params }, app) {
  const servicio = app.servicios.docente
  const estudianteId = Number(params.id)
  const envioDisponible = servicio.capacidades.envioPadres
  seleccionEstudiante.guardar(estudianteId)

  renderizar(contenedor, plantillaPantalla({
    cabecera: encabezado({ titulo: 'Acciones', rutaAtras: RUTAS_DOCENTE.falencias(estudianteId) }),
    contenido: html`
      <section class="animo" aria-label="Mensaje de ánimo">
        ${icono('corazon', { clase: 'animo__corazon' })}
        ${mascota({ variante: 'animo', clase: 'animo__mascota' })}
        ${icono('huella', { clase: 'animo__huella' })}
        <p class="animo__mensaje">¡Tú puedes lograrlo! ${icono('corazon', { clase: 'animo__mensaje-corazon' })}</p>
      </section>
      <div class="acciones" data-region="acciones"></div>`,
    navegacion: navegacionDocente()
  }))

  const region = contenedor.querySelector('[data-region="acciones"]')
  let recomendaciones = []

  function mostrar ({ estudiante }) {
    return html`
      <section class="tarjeta sugerencias">
        <h2 class="sugerencias__titulo">${icono('portapapeles', { clase: 'sugerencias__icono' })}Sugerencias para reforzar</h2>
        <p class="sugerencias__estudiante">${estudiante.nombre}</p>
        <div data-region="lista">${listaRecomendaciones(recomendaciones)}</div>
        <form class="sugerencias__formulario" data-formulario="agregar" novalidate>
          <label class="solo-lectores" for="nueva-sugerencia">Nueva sugerencia</label>
          <input class="campo__entrada sugerencias__entrada" id="nueva-sugerencia" name="texto" type="text"
                 placeholder="Agregar sugerencia…" maxlength="${MAX_LONGITUD_RECOMENDACION}" autocomplete="off">
          <button class="sugerencias__agregar" type="submit" aria-label="Agregar sugerencia">${icono('mas')}</button>
        </form>
        <p class="mensaje-error" role="alert" data-mensaje-sugerencias></p>
      </section>

      ${botonPrincipal({ texto: 'Enviar reporte a padres', iconoInicio: 'avion', accion: 'enviar-padres', deshabilitado: !envioDisponible })}
      <p class="acciones__nota" role="status" data-mensaje-envio>
        ${envioDisponible ? '' : 'El envío a padres estará disponible cuando exista el servicio en el servidor.'}
      </p>
      ${avisoDatosEjemplo({ visible: servicio.capacidades.datosEjemplo })}`
  }

  function conectar (_datos, regionLista) {
    const lista = regionLista.querySelector('[data-region="lista"]')
    const mensaje = regionLista.querySelector('[data-mensaje-sugerencias]')
    const formulario = regionLista.querySelector('[data-formulario="agregar"]')

    function repintar () {
      renderizar(lista, listaRecomendaciones(recomendaciones))
    }

    // Ejecuta un cambio en el servicio, bloquea los controles mientras tanto y muestra el error si falla
    async function ejecutar (cambio, control) {
      mensaje.textContent = ''
      if (control) control.disabled = true
      try {
        await cambio()
        recomendaciones = (await servicio.listarRecomendaciones(estudianteId)).recomendaciones
        if (lista.isConnected) repintar()
        return true
      } catch (error) {
        if (mensaje.isConnected) mensaje.textContent = obtenerMensajeError(error)
        if (control && control.isConnected) control.disabled = false
        return false
      }
    }

    lista.addEventListener('click', (evento) => {
      const boton = evento.target.closest('[data-accion]')
      if (!boton) return
      const recomendacion = recomendaciones.find((candidata) => candidata.id === boton.dataset.id)
      if (!recomendacion) return
      if (boton.dataset.accion === 'alternar') {
        ejecutar(() => servicio.actualizarRecomendacion(estudianteId, recomendacion.id, { incluida: !recomendacion.incluida }), boton)
      } else if (boton.dataset.accion === 'eliminar') {
        ejecutar(() => servicio.eliminarRecomendacion(estudianteId, recomendacion.id), boton)
      }
    })

    formulario.addEventListener('submit', async (evento) => {
      evento.preventDefault()
      const entrada = formulario.elements.texto
      const texto = entrada.value.trim()
      if (!texto) {
        mensaje.textContent = 'Escribe la sugerencia antes de agregarla.'
        entrada.focus()
        return
      }
      const agregada = await ejecutar(() => servicio.agregarRecomendacion(estudianteId, texto), formulario.querySelector('button'))
      if (agregada && entrada.isConnected) {
        entrada.value = ''
        formulario.querySelector('button').disabled = false
        entrada.focus()
      }
    })

    regionLista.querySelector('[data-accion="enviar-padres"]').addEventListener('click', async (evento) => {
      const boton = evento.currentTarget
      const nota = regionLista.querySelector('[data-mensaje-envio]')
      boton.disabled = true
      try {
        await servicio.enviarReportePadres(estudianteId, {
          recomendaciones: recomendaciones.filter((recomendacion) => recomendacion.incluida).map((recomendacion) => recomendacion.id)
        })
        nota.textContent = 'Reporte enviado a los padres.'
      } catch (error) {
        nota.textContent = obtenerMensajeError(error)
        boton.disabled = false
      }
    })
  }

  cargarRegion(region, {
    cargar: async () => {
      const datos = await servicio.listarRecomendaciones(estudianteId)
      recomendaciones = datos.recomendaciones
      return datos
    },
    mostrar,
    alMostrar: conectar,
    textoCargando: 'Cargando sugerencias…'
  })
}
