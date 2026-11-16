// Código de grupo, cambio y restablecimiento de contraseña, y límite de intentos
const request = require('supertest')

jest.mock('../src/repositorios/repositorioUsuarios', () => {
  let usuarios = []
  return {
    reiniciar: (iniciales) => { usuarios = iniciales.map((usuario) => ({ ...usuario })) },
    obtenerTodos: () => usuarios,
    buscarPorCorreo: async (correo) => usuarios.find((u) => u.correo === correo) || null,
    buscarPorId: async (id) => usuarios.find((u) => u.id === id) || null,
    crearUsuario: async (datos) => {
      const usuario = { id: usuarios.length + 1, creadoEn: new Date(), ...datos }
      usuarios.push(usuario)
      return usuario
    },
    actualizarContrasena: async (id, hashContrasena) => { usuarios.find((u) => u.id === id).hashContrasena = hashContrasena },
    asignarDocentePorId: async (estudianteId, docenteId) => { usuarios.find((u) => u.id === estudianteId).docenteId = docenteId },
    buscarDocentePorCodigo: async (codigo) => usuarios.find((u) => u.rol === 'docente' && u.codigoGrupo === codigo) || null,
    obtenerCodigoGrupo: async (id) => usuarios.find((u) => u.id === id)?.codigoGrupo || null,
    actualizarCodigoGrupo: async (id, codigo) => {
      if (usuarios.some((u) => u.codigoGrupo === codigo)) throw Object.assign(new Error('en uso'), { codigo: 'CODIGO_EN_USO' })
      usuarios.find((u) => u.id === id).codigoGrupo = codigo
      return codigo
    },
    buscarEstudianteDeDocente: async (docenteId, id) => {
      const estudiante = usuarios.find((u) => u.id === id && u.rol === 'estudiante' && u.docenteId === docenteId)
      return estudiante ? { id: estudiante.id, nombre: estudiante.nombre, nivel: estudiante.nivel } : null
    }
  }
})

const repositorioUsuarios = require('../src/repositorios/repositorioUsuarios')
const { crearApp } = require('../src/app')
const { generarToken, cifrarContrasena } = require('../src/servicios/servicioAutenticacion')
const servicioGrupos = require('../src/servicios/servicioGrupos')

let hashClave
const tokenDocente = generarToken({ id: 1, rol: 'docente', nivel: null })
const tokenEstudiante = generarToken({ id: 2, rol: 'estudiante', nivel: 1 })
const conToken = (peticion, token) => peticion.set('Authorization', `Bearer ${token}`)

beforeAll(async () => { hashClave = await cifrarContrasena('claveActual1') })

beforeEach(() => {
  repositorioUsuarios.reiniciar([
    { id: 1, nombre: 'Jhoan Segura', correo: 'profe@usta.edu.co', rol: 'docente', nivel: null, hashContrasena: hashClave, codigoGrupo: 'ABC234' },
    { id: 2, nombre: 'Ana', correo: 'ana@ejemplo.com', rol: 'estudiante', nivel: 1, hashContrasena: hashClave, docenteId: null }
  ])
})

describe('servicioGrupos', () => {
  test('genera códigos de 6 caracteres sin letras confusas y normaliza lo que escribe el estudiante', () => {
    const codigo = servicioGrupos.generarCodigo()
    expect(codigo).toMatch(/^[A-HJKMNP-Z2-9]{6}$/)
    expect(servicioGrupos.normalizarCodigo(' abc-234 ')).toBe('ABC234')
    expect(servicioGrupos.normalizarCodigo(5)).toBe('')
  })

  test('obtiene el código existente o crea uno nuevo', async () => {
    expect(await servicioGrupos.obtenerCodigo(1)).toBe('ABC234')
    repositorioUsuarios.obtenerTodos()[0].codigoGrupo = null
    expect(await servicioGrupos.obtenerCodigo(1)).toMatch(/^[A-Z2-9]{6}$/)
  })
})

describe('código de grupo', () => {
  test('el docente consulta y regenera su código', async () => {
    const consulta = await conToken(request(crearApp()).get('/api/docente/grupo'), tokenDocente)
    expect(consulta.body).toEqual({ codigo: 'ABC234' })
    const nuevo = await conToken(request(crearApp()).post('/api/docente/grupo/codigo'), tokenDocente)
    expect(nuevo.body.codigo).not.toBe('ABC234')
  })

  test('el estudiante se une con el código y consulta su grupo', async () => {
    const app = crearApp()
    expect((await conToken(request(app).get('/api/estudiante/grupo'), tokenEstudiante)).body).toEqual({ docente: null })

    const union = await conToken(request(app).post('/api/estudiante/grupo').send({ codigo: 'abc 234' }), tokenEstudiante)
    expect(union.status).toBe(200)
    expect(union.body).toEqual({ docente: { id: 1, nombre: 'Jhoan Segura' } })
    expect((await conToken(request(app).get('/api/estudiante/grupo'), tokenEstudiante)).body.docente.nombre).toBe('Jhoan Segura')
  })

  test('un código inexistente responde CODIGO_GRUPO_INVALIDO', async () => {
    const respuesta = await conToken(request(crearApp()).post('/api/estudiante/grupo').send({ codigo: 'ZZZZZZ' }), tokenEstudiante)
    expect(respuesta.status).toBe(400)
    expect(respuesta.body.error).toBe('CODIGO_GRUPO_INVALIDO')
  })

  test('el registro con código deja al estudiante en el grupo', async () => {
    const respuesta = await request(crearApp()).post('/api/auth/registro')
      .send({ nombre: 'Luis', correo: 'luis@ejemplo.com', contrasena: 'claveSegura1', nivel: 2, codigoGrupo: 'ABC234' })
    expect(respuesta.status).toBe(201)
    expect(respuesta.body.usuario.docenteId).toBe(1)

    const invalido = await request(crearApp()).post('/api/auth/registro')
      .send({ nombre: 'Eva', correo: 'eva@ejemplo.com', contrasena: 'claveSegura1', nivel: 1, codigoGrupo: 'NOEXISTE' })
    expect(invalido.body.error).toBe('CODIGO_GRUPO_INVALIDO')

    const malFormado = await request(crearApp()).post('/api/auth/registro')
      .send({ nombre: 'Eva', correo: 'eva@ejemplo.com', contrasena: 'claveSegura1', nivel: 1, codigoGrupo: 12 })
    expect(malFormado.body.detalles[0].campo).toBe('codigoGrupo')
  })
})

describe('PATCH /api/auth/contrasena', () => {
  test('cambia la contraseña con la actual correcta', async () => {
    const app = crearApp()
    const respuesta = await conToken(request(app).patch('/api/auth/contrasena')
      .send({ contrasenaActual: 'claveActual1', contrasenaNueva: 'claveNueva22' }), tokenEstudiante)
    expect(respuesta.status).toBe(204)
    const ingreso = await request(app).post('/api/auth/ingreso').send({ correo: 'ana@ejemplo.com', contrasena: 'claveNueva22' })
    expect(ingreso.status).toBe(200)
  })

  test('rechaza la actual incorrecta y las nuevas inválidas', async () => {
    const app = crearApp()
    const enviar = (cuerpo) => conToken(request(app).patch('/api/auth/contrasena').send(cuerpo), tokenEstudiante)
    expect((await enviar({ contrasenaActual: 'otraClave1', contrasenaNueva: 'claveNueva22' })).body.error).toBe('CONTRASENA_INCORRECTA')
    expect((await enviar({ contrasenaActual: 'claveActual1', contrasenaNueva: 'corta' })).body.detalles[0].campo).toBe('contrasenaNueva')
    expect((await enviar({ contrasenaActual: 'claveActual1', contrasenaNueva: 'claveActual1' })).body.detalles[0].mensaje).toMatch(/diferente/)
    expect((await enviar({ contrasenaNueva: 'x'.repeat(80) })).body.detalles).toHaveLength(2)
  })

  test('exige token', async () => {
    expect((await request(crearApp()).patch('/api/auth/contrasena').send({})).status).toBe(401)
  })
})

describe('contraseña temporal del docente', () => {
  test('el docente restablece la contraseña de su estudiante', async () => {
    repositorioUsuarios.obtenerTodos()[1].docenteId = 1
    const app = crearApp()
    const respuesta = await conToken(request(app).post('/api/docente/estudiantes/2/contrasena-temporal'), tokenDocente)
    expect(respuesta.status).toBe(200)
    expect(respuesta.body.contrasenaTemporal).toMatch(/^[a-z2-9]{10}$/)
    const ingreso = await request(app).post('/api/auth/ingreso')
      .send({ correo: 'ana@ejemplo.com', contrasena: respuesta.body.contrasenaTemporal })
    expect(ingreso.status).toBe(200)
  })

  test('no puede restablecer a un estudiante que no es suyo', async () => {
    const respuesta = await conToken(request(crearApp()).post('/api/docente/estudiantes/2/contrasena-temporal'), tokenDocente)
    expect(respuesta.status).toBe(404)
  })
})

describe('límite de intentos', () => {
  test('tras 10 ingresos fallidos responde 429 DEMASIADOS_INTENTOS', async () => {
    const app = crearApp()
    for (let i = 0; i < 10; i++) {
      const fallido = await request(app).post('/api/auth/ingreso').send({ correo: 'ana@ejemplo.com', contrasena: 'equivocada' })
      expect(fallido.status).toBe(401)
    }
    const bloqueado = await request(app).post('/api/auth/ingreso').send({ correo: 'ana@ejemplo.com', contrasena: 'claveActual1' })
    expect(bloqueado.status).toBe(429)
    expect(bloqueado.body.error).toBe('DEMASIADOS_INTENTOS')
  })
})
