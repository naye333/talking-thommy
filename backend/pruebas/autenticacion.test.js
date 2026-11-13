const request = require('supertest')

// Reemplaza la base de datos por una lista en memoria
jest.mock('../src/repositorios/repositorioUsuarios', () => {
  const usuarios = []
  return {
    reiniciar: () => { usuarios.length = 0 },
    buscarPorCorreo: async (correo) => usuarios.find((u) => u.correo === correo) || null,
    buscarPorId: async (id) => usuarios.find((u) => u.id === id) || null,
    crearUsuario: async (datos) => {
      const usuario = { id: usuarios.length + 1, creadoEn: new Date(), ...datos }
      usuarios.push(usuario)
      return usuario
    }
  }
})

const repositorioUsuarios = require('../src/repositorios/repositorioUsuarios')
const { crearApp } = require('../src/app')
const { generarToken, cifrarContrasena } = require('../src/servicios/servicioAutenticacion')

const app = crearApp()
const estudianteValido = {
  nombre: 'Sara Cardenas',
  correo: 'Sara@Ejemplo.com',
  contrasena: 'claveSegura123',
  nivel: 1
}

beforeEach(() => repositorioUsuarios.reiniciar())

describe('POST /api/auth/registro', () => {
  test('crea un estudiante y devuelve token sin el hash', async () => {
    const respuesta = await request(app).post('/api/auth/registro').send(estudianteValido)

    expect(respuesta.status).toBe(201)
    expect(respuesta.body.token).toEqual(expect.any(String))
    expect(respuesta.body.usuario).toMatchObject({
      nombre: 'Sara Cardenas',
      correo: 'sara@ejemplo.com', // se normaliza en minúsculas
      rol: 'estudiante',
      nivel: 1
    })
    expect(respuesta.body.usuario).not.toHaveProperty('hashContrasena')
  })

  test('ignora un rol enviado por el cliente', async () => {
    const respuesta = await request(app)
      .post('/api/auth/registro')
      .send({ ...estudianteValido, rol: 'docente' })

    expect(respuesta.body.usuario.rol).toBe('estudiante')
  })

  test('rechaza un correo repetido', async () => {
    await request(app).post('/api/auth/registro').send(estudianteValido)
    const respuesta = await request(app).post('/api/auth/registro').send(estudianteValido)

    expect(respuesta.status).toBe(409)
    expect(respuesta.body.error).toBe('CORREO_EN_USO')
  })

  test('devuelve los campos inválidos', async () => {
    const respuesta = await request(app)
      .post('/api/auth/registro')
      .send({ nombre: '', correo: 'no-es-correo', contrasena: '123', nivel: 5 })

    expect(respuesta.status).toBe(400)
    expect(respuesta.body.error).toBe('DATOS_INVALIDOS')
    const campos = respuesta.body.detalles.map((detalle) => detalle.campo)
    expect(campos).toEqual(expect.arrayContaining(['nombre', 'correo', 'contrasena', 'nivel']))
  })

  test('rechaza contraseñas de más de 72 caracteres', async () => {
    const respuesta = await request(app)
      .post('/api/auth/registro')
      .send({ ...estudianteValido, contrasena: 'a'.repeat(73) })

    expect(respuesta.status).toBe(400)
  })

  test('responde 400 si el JSON está mal formado', async () => {
    const respuesta = await request(app)
      .post('/api/auth/registro')
      .set('Content-Type', 'application/json')
      .send('{ esto no es json')

    expect(respuesta.status).toBe(400)
    expect(respuesta.body.error).toBe('JSON_INVALIDO')
  })
})

describe('POST /api/auth/ingreso', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/registro').send(estudianteValido)
  })

  test('inicia sesión con credenciales correctas', async () => {
    const respuesta = await request(app)
      .post('/api/auth/ingreso')
      .send({ correo: 'sara@ejemplo.com', contrasena: 'claveSegura123' })

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.token).toEqual(expect.any(String))
  })

  test('mismo error para contraseña incorrecta y correo inexistente', async () => {
    const malaClave = await request(app)
      .post('/api/auth/ingreso')
      .send({ correo: 'sara@ejemplo.com', contrasena: 'otraClave999' })
    const sinCuenta = await request(app)
      .post('/api/auth/ingreso')
      .send({ correo: 'nadie@ejemplo.com', contrasena: 'claveSegura123' })

    expect(malaClave.status).toBe(401)
    expect(sinCuenta.status).toBe(401)
    expect(malaClave.body.error).toBe('CREDENCIALES_INVALIDAS')
    expect(sinCuenta.body.error).toBe('CREDENCIALES_INVALIDAS')
  })

  test('exige correo y contraseña', async () => {
    const respuesta = await request(app).post('/api/auth/ingreso').send({})
    expect(respuesta.status).toBe(400)
  })
})

describe('GET /api/auth/yo', () => {
  test('devuelve el usuario del token', async () => {
    const registro = await request(app).post('/api/auth/registro').send(estudianteValido)
    const respuesta = await request(app)
      .get('/api/auth/yo')
      .set('Authorization', `Bearer ${registro.body.token}`)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.usuario.correo).toBe('sara@ejemplo.com')
  })

  test('responde 401 sin token', async () => {
    const respuesta = await request(app).get('/api/auth/yo')
    expect(respuesta.status).toBe(401)
    expect(respuesta.body.error).toBe('TOKEN_REQUERIDO')
  })

  test('responde 401 con token falso', async () => {
    const respuesta = await request(app).get('/api/auth/yo').set('Authorization', 'Bearer falso')
    expect(respuesta.body.error).toBe('TOKEN_INVALIDO')
  })

  test('responde 404 si el usuario del token ya no existe', async () => {
    const token = generarToken({ id: 999, rol: 'estudiante', nivel: 1 })
    const respuesta = await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${token}`)
    expect(respuesta.status).toBe(404)
  })
})

describe('exigirRol', () => {
  const { exigirRol } = require('../src/middlewares/autenticacion')

  test('deja pasar al rol permitido y bloquea a los demás', () => {
    const siguiente = jest.fn()
    exigirRol('docente')({ usuario: { rol: 'docente' } }, {}, siguiente)
    expect(siguiente).toHaveBeenCalledWith()

    const bloqueado = jest.fn()
    exigirRol('docente')({ usuario: { rol: 'estudiante' } }, {}, bloqueado)
    expect(bloqueado.mock.calls[0][0].codigo).toBe('PERMISO_DENEGADO')
  })
})

describe('cifrarContrasena', () => {
  test('no guarda la contraseña en texto plano', async () => {
    const hash = await cifrarContrasena('claveSegura123')
    expect(hash).not.toContain('claveSegura123')
    expect(hash.startsWith('$2')).toBe(true)
  })
})
