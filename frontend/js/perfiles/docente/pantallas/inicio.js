// Inicio del docente: saludo, Thommy y accesos rápidos.
import { html, renderizar } from '../../../nucleo/dom.js'
import { plantillaPantalla } from '../../../componentes/estructura.js'
import { mascota } from '../../../componentes/elementos.js'
import { tarjetaAcceso } from '../../../componentes/tarjetas.js'
import { menuLateral, conectarMenuLateral } from '../../../componentes/menuLateral.js'
import { icono } from '../../../componentes/iconos.js'
import { navegacionDocente, RUTAS_DOCENTE, ELEMENTOS_MENU_DOCENTE } from '../navegacion.js'

export function pantallaInicioDocente ({ contenedor }, app) {
  const usuario = app.sesion.obtenerUsuario()

  renderizar(contenedor, plantillaPantalla({
    clase: 'inicio-docente',
    cabecera: html`
      <header class="inicio-docente__barra">
        <button class="boton-icono" type="button" data-accion="abrir-menu" aria-label="Abrir menú">${icono('menu')}</button>
        <div class="inicio-docente__acciones">
          <a class="boton-icono" href="#${RUTAS_DOCENTE.alertas}" aria-label="Alertas">${icono('campana')}</a>
          <a class="inicio-docente__perfil" href="#${RUTAS_DOCENTE.configuracion}" aria-label="Mi cuenta">${icono('avatarUsuario')}</a>
        </div>
      </header>`,
    contenido: html`
      <section class="inicio-docente__saludo">
        <h1 class="inicio-docente__titulo">Hola, Profe ${icono('corazon', { clase: 'inicio-docente__corazon' })}</h1>
        <p class="inicio-docente__texto">Aquí puedes revisar el progreso de tus estudiantes.</p>
        ${icono('huella', { clase: 'inicio-docente__huella' })}
      </section>

      <div class="inicio-docente__escena">
        ${mascota({ variante: 'docente', clase: 'inicio-docente__mascota' })}
      </div>

      <nav class="inicio-docente__accesos" aria-label="Accesos rápidos">
        ${tarjetaAcceso({ etiqueta: 'Mis Estudiantes', iconoNombre: 'estudiantes', ruta: RUTAS_DOCENTE.estudiantes })}
        ${tarjetaAcceso({ etiqueta: 'Reportes', iconoNombre: 'barras', ruta: RUTAS_DOCENTE.reportes, destacada: true })}
        ${tarjetaAcceso({ etiqueta: 'Alertas', iconoNombre: 'campana', ruta: RUTAS_DOCENTE.alertas })}
        ${tarjetaAcceso({ etiqueta: 'Configuración', iconoNombre: 'engranaje', ruta: RUTAS_DOCENTE.configuracion })}
      </nav>

      ${menuLateral({ titulo: usuario?.nombre || 'Docente', subtitulo: usuario?.correo, elementos: ELEMENTOS_MENU_DOCENTE })}`,
    navegacion: navegacionDocente()
  }))

  return conectarMenuLateral(contenedor)
}
