// Gráficos en SVG sin librerías: anillo de progreso, barra de progreso y gráfico de línea.
import { html, crudo } from '../nucleo/dom.js'

let contadorGraficos = 0
function idUnico (prefijo) {
  contadorGraficos += 1
  return `${prefijo}-${contadorGraficos}`
}

export function limitarPorcentaje (valor) {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return 0
  return Math.min(100, Math.max(0, numero))
}

export function anilloProgreso ({ valor, tamano = 92, grosor = 11, etiqueta = 'Progreso' }) {
  const porcentaje = limitarPorcentaje(valor)
  const radio = (tamano - grosor) / 2
  const circunferencia = 2 * Math.PI * radio
  const relleno = (circunferencia * porcentaje) / 100
  const id = idUnico('anillo')
  const centro = tamano / 2
  return html`
    <svg class="anillo" width="${tamano}" height="${tamano}" viewBox="0 0 ${tamano} ${tamano}"
         role="img" aria-label="${etiqueta}: ${Math.round(porcentaje)}%">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#d4f79a"/>
          <stop offset="100%" stop-color="#5fbf2f"/>
        </linearGradient>
      </defs>
      <circle cx="${centro}" cy="${centro}" r="${radio}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${grosor}"/>
      <circle cx="${centro}" cy="${centro}" r="${radio}" fill="none" stroke="url(#${id})" stroke-width="${grosor}"
              stroke-linecap="round" stroke-dasharray="${relleno.toFixed(2)} ${circunferencia.toFixed(2)}"
              transform="rotate(-90 ${centro} ${centro})"/>
    </svg>`
}

export function barraProgreso ({ valor, etiqueta }) {
  const porcentaje = limitarPorcentaje(valor)
  return html`
    <div class="barra-progreso" role="progressbar" aria-label="${etiqueta}"
         aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(porcentaje)}">
      <span class="barra-progreso__relleno" style="width: ${porcentaje}%"></span>
    </div>`
}

// Convierte los valores en coordenadas dentro del área del gráfico
export function calcularPuntosGrafico ({ valores, minimo, maximo, area }) {
  const pasoX = valores.length > 1 ? area.ancho / (valores.length - 1) : 0
  const rango = maximo - minimo || 1
  return valores.map((valor, indice) => {
    const acotado = Math.min(maximo, Math.max(minimo, valor))
    return {
      x: area.x + pasoX * indice,
      y: area.y + area.alto - ((acotado - minimo) / rango) * area.alto
    }
  })
}

// Curva suave que pasa por todos los puntos (Catmull-Rom convertida a Bézier)
export function trazarCurva (puntos) {
  if (puntos.length === 0) return ''
  let trazo = `M${puntos[0].x.toFixed(1)} ${puntos[0].y.toFixed(1)}`
  for (let i = 0; i < puntos.length - 1; i++) {
    const anterior = puntos[i - 1] || puntos[i]
    const actual = puntos[i]
    const siguiente = puntos[i + 1]
    const posterior = puntos[i + 2] || siguiente
    const control1 = { x: actual.x + (siguiente.x - anterior.x) / 6, y: actual.y + (siguiente.y - anterior.y) / 6 }
    const control2 = { x: siguiente.x - (posterior.x - actual.x) / 6, y: siguiente.y - (posterior.y - actual.y) / 6 }
    trazo += ` C${control1.x.toFixed(1)} ${control1.y.toFixed(1)} ${control2.x.toFixed(1)} ${control2.y.toFixed(1)} ${siguiente.x.toFixed(1)} ${siguiente.y.toFixed(1)}`
  }
  return trazo
}

// puntos: [{ valor, etiqueta? }]. Solo los puntos con etiqueta se rotulan en el eje X.
export function graficoLinea ({ puntos, minimo = 40, maximo = 100, marcas = [40, 70, 100], descripcion }) {
  const ancho = 300
  const alto = 170
  const area = { x: 44, y: 22, ancho: 236, alto: 110 }
  const coordenadas = calcularPuntosGrafico({ valores: puntos.map((punto) => punto.valor), minimo, maximo, area })
  const curva = trazarCurva(coordenadas)
  const base = area.y + area.alto
  const ultimo = coordenadas[coordenadas.length - 1]
  const ultimoValor = puntos[puntos.length - 1]?.valor
  const id = idUnico('area')
  const posicionY = (marca) => area.y + area.alto - ((marca - minimo) / (maximo - minimo)) * area.alto

  return html`
    <svg class="grafico-linea" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${descripcion}">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#a6e35f" stop-opacity="0.38"/>
          <stop offset="100%" stop-color="#a6e35f" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${marcas.map((marca) => html`
        <text class="grafico-linea__marca" x="${area.x - 14}" y="${posicionY(marca) + 4}" text-anchor="end">${marca}</text>
        <line x1="${area.x - 6}" x2="${area.x}" y1="${posicionY(marca)}" y2="${posicionY(marca)}" class="grafico-linea__eje"/>`)}
      <line x1="${area.x}" x2="${area.x}" y1="${area.y - 6}" y2="${base}" class="grafico-linea__eje"/>
      <line x1="${area.x}" x2="${area.x + area.ancho + 6}" y1="${base}" y2="${base}" class="grafico-linea__eje"/>
      ${coordenadas.length > 1
        ? html`
          <path d="${crudo(`${curva} L${ultimo.x.toFixed(1)} ${base} L${coordenadas[0].x.toFixed(1)} ${base} Z`)}" fill="url(#${id})"/>
          <path d="${crudo(curva)}" class="grafico-linea__curva"/>`
        : ''}
      ${coordenadas.map((punto, indice) => indice === coordenadas.length - 1
        ? html`<circle cx="${punto.x}" cy="${punto.y}" r="5.5" class="grafico-linea__punto grafico-linea__punto--ultimo"/>`
        : html`<circle cx="${punto.x}" cy="${punto.y}" r="3.6" class="grafico-linea__punto"/>`)}
      ${puntos.map((punto, indice) => punto.etiqueta
        ? html`<text class="grafico-linea__etiqueta" x="${coordenadas[indice].x}" y="${base + 26}" text-anchor="middle">${punto.etiqueta}</text>`
        : '')}
      ${ultimo
        ? html`
          <g class="grafico-linea__burbuja" transform="translate(${Math.min(ultimo.x, ancho - 26)} ${Math.max(ultimo.y - 30, 14)})">
            <rect x="-24" y="-14" width="48" height="26" rx="10"/>
            <path d="M-5 12 0 18 5 12z"/>
            <text x="0" y="4" text-anchor="middle">${Math.round(ultimoValor)}%</text>
          </g>`
        : ''}
    </svg>`
}
