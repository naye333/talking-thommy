// Iconos SVG en línea (sin librerías). Los de trazo usan currentColor; los de color tienen su propia paleta.
import { crudo } from '../nucleo/dom.js'

const TRAZO = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'

const ENGRANAJE = 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'

const ICONOS = {
  // ---- Trazo (toman el color del texto) ----
  menu: `<g ${TRAZO} stroke-width="2.2"><path d="M3.5 6h17M3.5 12h17M3.5 18h17"/></g>`,
  campana: `<g ${TRAZO}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></g>`,
  casa: `<g ${TRAZO}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v12h14V9"/><path d="M10 21v-6h4v6"/></g>`,
  estudiantesTrazo: `<g ${TRAZO}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></g>`,
  barrasTrazo: `<g ${TRAZO} stroke-width="2.4"><path d="M4 20v-5M9.3 20V9M14.6 20v-7M20 20V4"/></g>`,
  chevronIzquierda: `<path ${TRAZO} stroke-width="2.4" d="m15 18-6-6 6-6"/>`,
  chevronDerecha: `<path ${TRAZO} stroke-width="2.2" d="m9 18 6-6-6-6"/>`,
  chevronAbajo: `<path ${TRAZO} stroke-width="2.4" d="m6 9 6 6 6-6"/>`,
  buscar: `<g ${TRAZO} stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></g>`,
  bombilla: `<g ${TRAZO} stroke-width="2.2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5z" fill="currentColor"/><path d="M9 18h6M10 22h4"/></g>`,
  portapapeles: `<g ${TRAZO} stroke-width="2.2"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></g>`,
  casillaMarcada: `<g ${TRAZO}><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12.2 2.8 2.8 5.4-5.8"/></g>`,
  casillaVacia: `<rect ${TRAZO} x="3.5" y="3.5" width="17" height="17" rx="3"/>`,
  mas: `<path ${TRAZO} stroke-width="2.4" d="M12 5v14M5 12h14"/>`,
  papelera: `<g ${TRAZO}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></g>`,
  salir: `<g ${TRAZO}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></g>`,
  cerrar: `<path ${TRAZO} stroke-width="2.4" d="M18 6 6 18M6 6l12 12"/>`,
  engranajeTrazo: `<g ${TRAZO}><path d="${ENGRANAJE}"/><circle cx="12" cy="12" r="3"/></g>`,

  // ---- Rellenos que toman el color del texto ----
  estudiantes: '<g fill="currentColor"><circle cx="12" cy="7" r="3.4"/><circle cx="5.2" cy="9.2" r="2.6"/><circle cx="18.8" cy="9.2" r="2.6"/><path d="M6.4 20.5c0-3.5 2.5-6.2 5.6-6.2s5.6 2.7 5.6 6.2z"/><path d="M.8 19.5c0-2.7 2-4.8 4.5-4.8 1 0 1.9.3 2.6.8-1.3 1.2-2.1 2.9-2.3 4z"/><path d="M23.2 19.5c0-2.7-2-4.8-4.5-4.8-1 0-1.9.3-2.6.8 1.3 1.2 2.1 2.9 2.3 4z"/></g>',
  barras: '<g fill="currentColor"><rect x="2.5" y="13" width="5" height="9" rx="1.4"/><rect x="9.5" y="7.5" width="5" height="14.5" rx="1.4"/><rect x="16.5" y="2" width="5" height="20" rx="1.4"/></g>',
  engranaje: `<path fill="currentColor" fill-rule="evenodd" d="${ENGRANAJE}M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z"/>`,
  birrete: '<g fill="currentColor"><path d="M21.4 10.9a1 1 0 0 0 0-1.8L12.8 5.2a2 2 0 0 0-1.6 0L2.6 9.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0z"/><path d="M6 13v3.2c0 1.8 2.7 3.3 6 3.3s6-1.5 6-3.3V13l-4.4 2a4 4 0 0 1-3.2 0z"/><path d="M21 10.5h1.5V16a.75.75 0 0 1-1.5 0z"/></g>',
  corazon: '<path fill="currentColor" d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  huella: '<g fill="currentColor"><ellipse cx="12" cy="16.2" rx="5.2" ry="4.4"/><ellipse cx="5.4" cy="10.6" rx="2" ry="2.5" transform="rotate(-20 5.4 10.6)"/><ellipse cx="9.4" cy="6.2" rx="2.1" ry="2.7" transform="rotate(-8 9.4 6.2)"/><ellipse cx="14.6" cy="6.2" rx="2.1" ry="2.7" transform="rotate(8 14.6 6.2)"/><ellipse cx="18.6" cy="10.6" rx="2" ry="2.5" transform="rotate(20 18.6 10.6)"/></g>',
  avion: '<g fill="currentColor"><path d="M21.9 2.1a.5.5 0 0 0-.6-.1L2.3 8.6a.5.5 0 0 0 0 .9l7.2 2.9 2.9 7.2a.5.5 0 0 0 .9 0l6.6-19a.5.5 0 0 0 0-.5z"/></g><path d="m21.6 2.4-11.4 11.4" stroke="#c3f17f" stroke-width="1.6" stroke-linecap="round"/>',

  // ---- De color propio (tarjetas de falencias, fortalezas y alertas) ----
  alertaAmarilla: '<path fill="#f7c43a" d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4.5" stroke="#1b1505" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.35" fill="#1b1505"/>',
  alertaRoja: '<path fill="#ef4f74" d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.35" fill="#fff"/>',
  estrella: '<path fill="#f7c43a" stroke="#f7c43a" stroke-width="1.5" stroke-linejoin="round" d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/>',
  exito: '<circle cx="12" cy="12" r="10.5" fill="#57c43a"/><path d="m7.4 12.4 3 3 6.2-6.6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  exclamacion: '<circle cx="12" cy="12" r="10.5" fill="#ec4d76"/><path d="M12 6.8v6.4" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="17" r="1.45" fill="#fff"/>',
  cerebro: '<path fill="#f597bd" d="M9 3.2a3.6 3.6 0 0 0-3.5 2.8A3.6 3.6 0 0 0 2.8 9.6a3.5 3.5 0 0 0 .6 4.9 3.6 3.6 0 0 0 3.1 4.7A3.1 3.1 0 0 0 12 20.6V4.6a3.6 3.6 0 0 0-3-1.4z"/><path fill="#f080ae" d="M15 3.2a3.6 3.6 0 0 1 3.5 2.8 3.6 3.6 0 0 1 2.7 3.6 3.5 3.5 0 0 1-.6 4.9 3.6 3.6 0 0 1-3.1 4.7 3.1 3.1 0 0 1-5.5 1.4V4.6a3.6 3.6 0 0 1 3-1.4z"/><g fill="none" stroke="#b73a72" stroke-width="1.3" stroke-linecap="round"><path d="M12 4.6v16M7.8 8.2c1.2.1 2.2 1 2.4 2.3M5.6 13.1c1.3-.4 2.7.1 3.4 1.3M8.6 17c.4-.9 1.3-1.5 2.3-1.5M16.2 8.2c-1.2.1-2.2 1-2.4 2.3M18.4 13.1c-1.3-.4-2.7.1-3.4 1.3M15.4 17c-.4-.9-1.3-1.5-2.3-1.5"/></g>',
  libro: '<path fill="#7aa7f7" stroke="#2c5fc9" stroke-width="1.2" stroke-linejoin="round" d="M1.8 5.4C4.6 4 8.3 4.1 11.3 6v14c-3-1.8-6.7-1.9-9.5-.5z"/><path fill="#6596ef" stroke="#2c5fc9" stroke-width="1.2" stroke-linejoin="round" d="M22.2 5.4C19.4 4 15.7 4.1 12.7 6v14c3-1.8 6.7-1.9 9.5-.5z"/><g fill="none" stroke="#e9f0ff" stroke-width="1.1" stroke-linecap="round"><path d="M4.3 9c1.5-.3 3-.2 4.6.5M4.3 12c1.5-.3 3-.2 4.6.5M4.3 15c1.5-.3 3-.2 4.6.5M19.7 9c-1.5-.3-3-.2-4.6.5M19.7 12c-1.5-.3-3-.2-4.6.5M19.7 15c-1.5-.3-3-.2-4.6.5"/></g>',
  engranajeColor: `<path fill="#7f8ff3" d="${ENGRANAJE}"/><circle cx="12" cy="12" r="3.6" fill="#232a63"/><circle cx="12" cy="12" r="1.6" fill="#a8b4ff"/>`,
  tendencia: '<g fill="#a6e35f"><rect x="3" y="15" width="4" height="7" rx="1"/><rect x="10" y="12" width="4" height="10" rx="1"/><rect x="17" y="9" width="4" height="13" rx="1"/></g><path d="M3 11.5 9 6.5l3.5 3L20 3" fill="none" stroke="#a6e35f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 3H20v4.5" fill="none" stroke="#a6e35f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  avatarUsuario: '<circle cx="12" cy="12" r="12" fill="#eef2ea"/><circle cx="12" cy="9.4" r="4.2" fill="#4c5648"/><path fill="#4c5648" d="M4.6 20.6C6.1 17.2 8.8 15.3 12 15.3s5.9 1.9 7.4 5.3A11.9 11.9 0 0 1 12 24a11.9 11.9 0 0 1-7.4-3.4z"/>'
}

export function icono (nombre, { clase = '', etiqueta = '' } = {}) {
  const contenido = ICONOS[nombre]
  if (!contenido) throw new Error(`Icono desconocido: ${nombre}`)
  const accesibilidad = etiqueta
    ? `role="img" aria-label="${etiqueta.replace(/"/g, '&quot;')}"`
    : 'aria-hidden="true" focusable="false"'
  return crudo(`<svg class="icono ${clase}" viewBox="0 0 24 24" ${accesibilidad}>${contenido}</svg>`)
}

export const NOMBRES_ICONOS = Object.keys(ICONOS)
