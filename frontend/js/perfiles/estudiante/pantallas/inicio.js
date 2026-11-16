// Inicio del estudiante: saludo, progreso y, en el centro, la invitación a hablar con Thommy.
import { html, renderizar } from '../../../nucleo/dom.js'
import { plantillaPantalla } from '../../../componentes/estructura.js'
import { mascota } from '../../../componentes/elementos.js'
import { tarjetaAcceso } from '../../../componentes/tarjetas.js'
import { menuLateral, conectarMenuLateral } from '../../../componentes/menuLateral.js'
import { icono } from '../../../componentes/iconos.js'
import { navegacionEstudiante, RUTAS_ESTUDIANTE, ELEMENTOS_MENU_ESTUDIANTE } from '../navegacion.js'

export function primerNombre (nombre) {
  return String(nombre || '').trim().split(/\s+/)[0] || ''
}

export function pantallaInicioEstudiante ({ contenedor }, app) {
  const usuario = app.sesion.obtenerUsuario()
  const nombre = primerNombre(usuario?.nombre)

  renderizar(contenedor, plantillaPantalla({
    clase: 'inicio-estudiante',
    cabecera: html`
      <header class="inicio-docente__barra">
        <button class="boton-icono" type="button" data-accion="abrir-menu" aria-label="Abrir menú">${icono('menu')}</button>
        <a class="inicio-docente__perfil" href="#${RUTAS_ESTUDIANTE.perfil}" aria-label="Mi perfil">${icono('avatarUsuario')}</a>
      </header>`,
    contenido: html`
      <section class="inicio-estudiante__saludo">
        <h1 class="inicio-estudiante__titulo">¡Hola${nombre ? `, ${nombre}` : ''}!</h1>
        <p class="inicio-estudiante__texto">¿Listo para mejorar tu inglés? ${icono('corazon', { clase: 'inicio-estudiante__corazon' })}</p>
      </section>

      <a class="tarjeta-progreso" href="#${RUTAS_ESTUDIANTE.progreso}">
        ${icono('barras', { clase: 'tarjeta-progreso__icono' })}
        <span class="tarjeta-progreso__textos">
          <span class="tarjeta-progreso__titulo">Tu progreso</span>
          <span class="tarjeta-progreso__subtitulo" data-region="progreso">¡Sigue así!</span>
        </span>
        ${icono('chevronDerecha', { clase: 'tarjeta-progreso__flecha' })}
      </a>

      <section class="hablar" aria-label="Conversar con Thommy">
        ${mascota({ variante: 'saludo', clase: 'hablar__mascota' })}
        <a class="hablar__boton" href="#${RUTAS_ESTUDIANTE.conversacion}">
          <span class="hablar__microfono">${icono('microfono')}</span>
          <span class="hablar__textos">
            <strong class="hablar__titulo">Habla con Thommy</strong>
            <span class="hablar__subtitulo">Practica tu inglés conversando</span>
          </span>
          ${icono('chevronDerecha', { clase: 'hablar__flecha' })}
        </a>
      </section>

      <nav class="inicio-estudiante__accesos" aria-label="Accesos rápidos">
        ${tarjetaAcceso({ etiqueta: 'Lecciones', iconoNombre: 'libroAbierto', ruta: RUTAS_ESTUDIANTE.lecciones })}
        ${tarjetaAcceso({ etiqueta: 'Progreso', iconoNombre: 'barras', ruta: RUTAS_ESTUDIANTE.progreso })}
        ${tarjetaAcceso({ etiqueta: 'Perfil', iconoNombre: 'engranaje', ruta: RUTAS_ESTUDIANTE.perfil })}
      </nav>

      ${menuLateral({ titulo: usuario?.nombre || 'Estudiante', subtitulo: usuario?.correo, elementos: ELEMENTOS_MENU_ESTUDIANTE })}`,
    navegacion: navegacionEstudiante('inicio')
  }))

  // El promedio es un dato complementario: si no carga, se queda el texto de ánimo
  const region = contenedor.querySelector('[data-region="progreso"]')
  app.servicios.progreso.obtenerProgreso()
    .then(({ promedioGeneral }) => {
      if (region.isConnected) region.textContent = `Promedio ${promedioGeneral}% · ¡Sigue así!`
    })
    .catch(() => {})

  return conectarMenuLateral(contenedor)
}
