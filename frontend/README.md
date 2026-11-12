# Talking Thommy – Frontend

Aplicación web del tutor conversacional, hecha con **HTML, CSS y JavaScript sin dependencias** (módulos ES nativos del navegador). Se adapta al ancho del celular y en pantallas grandes se muestra centrada.

## Puesta en marcha

Requiere Node.js 20 o superior (solo para el servidor de desarrollo y las pruebas; la app no instala paquetes).

```bash
cd frontend
npm run dev     # http://localhost:8081
npm test        # pruebas en Node
```

El puerto 8081 es el que el backend permite por defecto en `ORIGENES_PERMITIDOS`. Las pruebas también se pueden ver en el navegador en `http://localhost:8081/pruebas/`.

La URL del backend se configura en [`js/config.js`](js/config.js).

## Estado de la integración con el backend

| Función | Fuente |
|---|---|
| Iniciar sesión, consultar la cuenta | API real: `POST /api/auth/ingreso`, `GET /api/auth/yo` |
| Estudiantes del docente, reportes, falencias, evolución, recomendaciones | **Datos de ejemplo** (`usarDatosEjemplo: true`) hasta que existan los endpoints. Propuesta en [`docs/propuesta-api-perfil-docente.md`](../docs/propuesta-api-perfil-docente.md) |
| Enviar reporte a padres | Deshabilitado: no existe el servicio |

Cuando el backend tenga esos endpoints, solo cambia la fuente de datos en `js/servicios/docente/`; las pantallas no se modifican.

## Estructura

```
frontend/
├── index.html               # contenedor único de la app
├── servidor-dev.js          # servidor estático de desarrollo (sin dependencias)
├── assets/img/              # mascota y otras imágenes
├── css/
│   ├── tokens.css           # colores, tipografía, espacios (compartidos)
│   ├── base.css             # reinicio y contenedor de la app
│   ├── componentes.css      # componentes compartidos entre perfiles
│   └── docente.css          # estilos propios de las pantallas del docente
├── js/
│   ├── app.js               # arranque: sesión, servicios, rutas y protección por rol
│   ├── config.js
│   ├── nucleo/              # enrutador, sesión, cliente de la API, utilidades del DOM
│   ├── servicios/           # acceso a datos (API real o datos de ejemplo)
│   ├── componentes/         # piezas de interfaz reutilizables (iconos, tarjetas, gráficos…)
│   └── perfiles/
│       ├── comun/           # ingreso, cuenta, página no encontrada
│       ├── docente/         # rutas, navegación y pantallas del docente
│       └── estudiante/      # punto de entrada del perfil de estudiante (pendiente)
└── pruebas/                 # mini marco de pruebas (Node y navegador)
```

### Agregar un perfil (por ejemplo, estudiante)

1. Crea sus pantallas en `js/perfiles/estudiante/pantallas/`.
2. Declara sus rutas en `js/perfiles/estudiante/rutas.js` con `perfil: 'estudiante'`.
3. Define su barra inferior en `js/perfiles/estudiante/navegacion.js` y usa `plantillaPantalla` de `js/componentes/`.

El enrutador ya protege cada ruta según el rol del token, y los componentes compartidos (encabezado, tarjetas, barras de progreso, gráficos, estados de carga y error) no dependen del perfil.
