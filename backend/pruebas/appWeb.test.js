// El backend sirve la app web (carpeta frontend) en la misma dirección que la API
const request = require('supertest')
const { crearApp } = require('../src/app')

describe('app web servida por el backend', () => {
  const app = crearApp()

  test('sirve la página y los archivos de la app', async () => {
    const pagina = await request(app).get('/')
    expect(pagina.status).toBe(200)
    expect(pagina.text).toMatch(/Talking Thommy/)
    expect((await request(app).get('/js/app.js')).status).toBe(200)
    expect((await request(app).get('/css/base.css')).headers['content-type']).toMatch(/css/)
    expect((await request(app).get('/assets/img/thommy-bienvenida.png')).status).toBe(200)
  })

  test('no publica código, configuración ni pruebas', async () => {
    for (const ruta of ['/package.json', '/servidor-dev.js', '/pruebas/index.html', '/android/build.gradle', '/js/../package.json', '/css/%2e%2e/package.json', '/js/no-existe.js']) {
      const respuesta = await request(app).get(ruta)
      expect([403, 404]).toContain(respuesta.status)
    }
  })

  test('permite las fuentes de Google en la política de seguridad', async () => {
    const politica = (await request(app).get('/')).headers['content-security-policy']
    expect(politica).toMatch(/fonts\.googleapis\.com/)
    expect(politica).toMatch(/fonts\.gstatic\.com/)
  })
})
