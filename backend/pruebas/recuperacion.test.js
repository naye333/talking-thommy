const request = require('supertest')
const bcrypt = require('bcryptjs')

// Base de datos en memoria: un estudiante con docente (código ABC234), un docente y un estudiante sin grupo
jest.mock('../src/repositorios/repositorioUsuarios', () => {
  let usuarios = []
  return {
    reiniciar: (lista) => { usuarios = lista },
    usuarios: () => usuarios,
    buscarPorCorreo: async (correo) => usuarios.find((u) => u.correo === correo) || null,
    obtenerCodigoClaseDeUsuario: async (id) => {
      const usuario = usuarios.find((u) => u.id === id)
      if (!usuario) return null
      if (usuario.rol === 'docente') return usuario.codigoGrupo || null
      return usuarios.find((u) => u.id === usuario.docenteId)?.codigoGrupo || null
    },
    actualizarContrasena: async (id, hash) => {
      usuarios.find((u) => u.id === id).hashContrasena = hash
    }
  }
})

const repositorioUsuarios = require('../src/repositorios/repositorioUsuarios')
const { crearApp } = require('../src/app')
const { crearServicioCaptcha, ALFABETO, LONGITUD } = require('../src/servicios/servicioCaptcha')

let captcha
let app

beforeEach(() => {
  repositorioUsuarios.reiniciar([
    { id: 1, nombre: 'Profe Demo', correo: 'profe@usta.edu.co', rol: 'docente', codigoGrupo: 'ABC234', hashContrasena: 'x' },
    { id: 2, nombre: 'Sara Cardenas', correo: 'sara@usta.edu.co', rol: 'estudiante', docenteId: 1, hashContrasena: 'x' },
    { id: 3, nombre: 'Luis Sin Grupo', correo: 'luis@usta.edu.co', rol: 'estudiante', docenteId: null, hashContrasena: 'x' }
  ])
  captcha = crearServicioCaptcha()
  app = crearApp({ captcha })
})

async function pedirCaptcha () {
  const respuesta = await request(app).get('/api/auth/captcha')
  return { ...respuesta.body, respuesta: captcha.respuestaDe(respuesta.body.captchaId) }
}

async function verificar (datos) {
  const { captchaId, respuesta } = await pedirCaptcha()
  return request(app).post('/api/auth/recuperar/verificar')
    .send({ captchaId, captchaRespuesta: respuesta, ...datos })
}

describe('servicioCaptcha', () => {
  test('genera una imagen SVG sin la respuesta escrita como texto', () => {
    const servicio = crearServicioCaptcha()
    const { captchaId, imagen } = servicio.generar()
    const respuesta = servicio.respuestaDe(captchaId)

    expect(respuesta).toHaveLength(LONGITUD)
    expect([...respuesta].every((letra) => ALFABETO.includes(letra))).toBe(true)
    expect(imagen.startsWith('data:image/svg+xml;base64,')).toBe(true)
    const svg = Buffer.from(imagen.split(',')[1], 'base64').toString()
    expect(svg).toContain('<polyline')
    expect(svg).not.toContain('<text')
  })

  test('acepta minúsculas y espacios, y sirve una sola vez', () => {
    const servicio = crearServicioCaptcha()
    const { captchaId } = servicio.generar()
    const respuesta = servicio.respuestaDe(captchaId)

    expect(servicio.verificar(captchaId, ` ${respuesta.toLowerCase()} `)).toBe(true)
    expect(servicio.verificar(captchaId, respuesta)).toBe(false)
  })

  test('una respuesta equivocada también gasta el captcha', () => {
    const servicio = crearServicioCaptcha()
    const { captchaId } = servicio.generar()
    const respuesta = servicio.respuestaDe(captchaId)

    expect(servicio.verificar(captchaId, 'ZZZZZ')).toBe(false)
    expect(servicio.verificar(captchaId, respuesta)).toBe(false)
  })

  test('vence después de 5 minutos', () => {
    let momento = 0
    const servicio = crearServicioCaptcha({ ahora: () => momento })
    const { captchaId } = servicio.generar()
    const respuesta = servicio.respuestaDe(captchaId)
    momento = 5 * 60 * 1000

    expect(servicio.verificar(captchaId, respuesta)).toBe(false)
  })

  test('no guarda más del máximo permitido', () => {
    const servicio = crearServicioCaptcha({ maximoGuardados: 3 })
    for (let i = 0; i < 10; i++) servicio.generar()
    expect(servicio.cantidad()).toBeLessThanOrEqual(3)
  })
})

describe('GET /api/auth/captcha', () => {
  test('devuelve un captcha nuevo sin caché', async () => {
    const respuesta = await request(app).get('/api/auth/captcha')

    expect(respuesta.status).toBe(200)
    expect(respuesta.headers['cache-control']).toBe('no-store')
    expect(respuesta.body).toEqual({ captchaId: expect.any(String), imagen: expect.stringMatching(/^data:image\/svg\+xml;base64,/) })
  })
})

describe('POST /api/auth/recuperar/verificar', () => {
  test('el estudiante se verifica con el código de la clase de su docente', async () => {
    const respuesta = await verificar({ correo: 'Sara@usta.edu.co', codigoGrupo: 'abc-234' })

    expect(respuesta.status).toBe(200)
    expect(respuesta.body).toEqual({ tokenRecuperacion: expect.any(String), nombre: 'Sara' })
  })

  test('el docente se verifica con su propio código', async () => {
    const respuesta = await verificar({ correo: 'profe@usta.edu.co', codigoGrupo: 'ABC234' })
    expect(respuesta.status).toBe(200)
  })

  test('rechaza un captcha equivocado antes de mirar la cuenta', async () => {
    const { captchaId } = await pedirCaptcha()
    const respuesta = await request(app).post('/api/auth/recuperar/verificar')
      .send({ correo: 'sara@usta.edu.co', codigoGrupo: 'ABC234', captchaId, captchaRespuesta: 'nope1' })

    expect(respuesta.status).toBe(400)
    expect(respuesta.body.error).toBe('CAPTCHA_INCORRECTO')
  })

  test('mismo error para código equivocado, correo inexistente o estudiante sin grupo', async () => {
    const casos = [
      { correo: 'sara@usta.edu.co', codigoGrupo: 'XYZ999' },
      { correo: 'nadie@usta.edu.co', codigoGrupo: 'ABC234' },
      { correo: 'luis@usta.edu.co', codigoGrupo: 'ABC234' }
    ]
    for (const caso of casos) {
      const respuesta = await verificar(caso)
      expect(respuesta.status).toBe(400)
      expect(respuesta.body).toEqual({ error: 'VERIFICACION_FALLIDA' })
    }
  })

  test('valida los campos obligatorios', async () => {
    const respuesta = await request(app).post('/api/auth/recuperar/verificar').send({ correo: 'no-es-correo' })

    expect(respuesta.status).toBe(400)
    expect(respuesta.body.error).toBe('DATOS_INVALIDOS')
    const campos = respuesta.body.detalles.map((detalle) => detalle.campo)
    expect(campos).toEqual(expect.arrayContaining(['correo', 'codigoGrupo', 'captchaRespuesta']))
  })
})

describe('POST /api/auth/recuperar/cambiar', () => {
  test('guarda la contraseña nueva cifrada y el permiso sirve una sola vez', async () => {
    const { body } = await verificar({ correo: 'sara@usta.edu.co', codigoGrupo: 'ABC234' })

    const primera = await request(app).post('/api/auth/recuperar/cambiar')
      .send({ tokenRecuperacion: body.tokenRecuperacion, contrasenaNueva: 'NuevaClave2026' })
    expect(primera.status).toBe(204)
    const sara = repositorioUsuarios.usuarios().find((u) => u.id === 2)
    expect(await bcrypt.compare('NuevaClave2026', sara.hashContrasena)).toBe(true)

    const segunda = await request(app).post('/api/auth/recuperar/cambiar')
      .send({ tokenRecuperacion: body.tokenRecuperacion, contrasenaNueva: 'OtraClave2026' })
    expect(segunda.status).toBe(400)
    expect(segunda.body.error).toBe('RECUPERACION_VENCIDA')
  })

  test('rechaza un permiso inventado', async () => {
    const respuesta = await request(app).post('/api/auth/recuperar/cambiar')
      .send({ tokenRecuperacion: 'inventado', contrasenaNueva: 'NuevaClave2026' })
    expect(respuesta.body.error).toBe('RECUPERACION_VENCIDA')
  })

  test('exige una contraseña de al menos 8 caracteres', async () => {
    const { body } = await verificar({ correo: 'sara@usta.edu.co', codigoGrupo: 'ABC234' })
    const respuesta = await request(app).post('/api/auth/recuperar/cambiar')
      .send({ tokenRecuperacion: body.tokenRecuperacion, contrasenaNueva: 'corta' })

    expect(respuesta.status).toBe(400)
    expect(respuesta.body.detalles[0].campo).toBe('contrasenaNueva')
  })
})

describe('permiso de recuperación', () => {
  test('vence a los 10 minutos', async () => {
    const { crearServicioRecuperacion } = require('../src/servicios/servicioRecuperacion')
    let momento = 0
    const servicioCaptcha = crearServicioCaptcha()
    const servicio = crearServicioRecuperacion({ captcha: servicioCaptcha, ahora: () => momento })
    const { captchaId } = servicioCaptcha.generar()
    const { tokenRecuperacion } = await servicio.verificar({
      correo: 'sara@usta.edu.co', codigoGrupo: 'ABC234', captchaId, captchaRespuesta: servicioCaptcha.respuestaDe(captchaId)
    })
    momento = 10 * 60 * 1000

    await expect(servicio.cambiar({ tokenRecuperacion, contrasenaNueva: 'NuevaClave2026' }))
      .rejects.toMatchObject({ codigo: 'RECUPERACION_VENCIDA' })
  })
})
