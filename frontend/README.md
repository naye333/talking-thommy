# Talking Thommy – Frontend

**App móvil** del tutor conversacional. La interfaz está hecha con **HTML, CSS y JavaScript sin librerías** y se empaqueta como app Android/iOS con [Capacitor](https://capacitorjs.com). El mismo código se puede probar en el navegador mientras se desarrolla.

Requiere Node.js 20 o superior. Para generar la app Android, también [Android Studio](https://developer.android.com/studio).

## Dónde se usa

En producción, el backend sirve esta app en la misma dirección que la API (Render). La app detecta sola la dirección de la API (`resolverUrlApi` en `js/config.js`): si la sirve el backend, usa esa misma dirección; con `npm run dev` (puerto 8081), usa `http://localhost:3000`.

## Desarrollo en el navegador

```bash
cd frontend
npm install     # solo la primera vez (instala Capacitor)
npm run dev     # http://localhost:8081  (usa la vista de celular del navegador: F12 → Ctrl+Shift+M)
npm test        # pruebas en Node; también en http://localhost:8081/pruebas/
```

El puerto 8081 es el que el backend permite por defecto en `ORIGENES_PERMITIDOS`.

## App Android

La primera vez:

```bash
npx cap add android
```

Cada vez que quieras probar cambios en el emulador o en un celular:

```bash
URL_API=https://<tu-backend> npm run android   # copia la app a www/, sincroniza y abre Android Studio
```

En Android Studio, pulsa **Run** con un emulador o con un celular conectado por USB.

- `URL_API` es la URL del backend que usará la app. Si no la pasas, se usa la de [`js/config.js`](js/config.js) (`http://localhost:3000`), que **no funciona dentro del celular**. En PowerShell, primero escribe `$env:URL_API="https://..."` y luego `npm run android`.
- Lo más simple es usar el backend desplegado en Render (HTTPS). Para usar el backend de tu PC desde el emulador, la URL es `http://10.0.2.2:3000`. Como es HTTP, en `android/app/src/main/AndroidManifest.xml` cambia `android:usesCleartextTraffic="false"` por `"true"` en `<application>` **solo en tu PC y sin subir ese cambio**: en el repositorio debe quedar en `false`.
- Las peticiones a la API salen por la capa nativa (`CapacitorHttp` en `capacitor.config.json`), así que el backend no necesita configurar CORS para la app.

### Versiones fijas de las dependencias de Android

El proyecto Android usa *dependency locking*: las versiones exactas quedan en los archivos `gradle.lockfile`, así todas las compilaciones usan las mismas. Cuando se agrega o actualiza un plugin de Capacitor, se regeneran así. Primero, desde `frontend`, se instalan las dependencias y se sincroniza Capacitor (crea `node_modules/@capacitor/android` y `android/capacitor-cordova-android-plugins`, que Gradle necesita):

```bash
npm install
npm run sync
```

Luego, desde `frontend/android`:

```bash
./gradlew escribirLocks --write-locks
```

En Windows (PowerShell): `.\gradlew.bat escribirLocks --write-locks`. Después se suben los `*.lockfile` generados.

## Estado de la integración con el backend

Todo usa la API real del backend (`js/config.js`):

| Función | Fuente |
|---|---|
| Registro (con código de grupo opcional), ingreso y cuenta | `POST /api/auth/registro`, `POST /api/auth/ingreso`, `GET /api/auth/yo` |
| Configuración: grupo y cambio de contraseña | `/api/estudiante/grupo`, `/api/docente/grupo`, `PATCH /api/auth/contrasena` (`js/servicios/servicioCuenta.js`) |
| Contraseña temporal para un estudiante (docente → Acciones) | `POST /api/docente/estudiantes/:id/contrasena-temporal` |
| Lecciones (syllabus) | `GET /api/syllabus`, `GET /api/syllabus/temas/:id` |
| Conversación con Thommy | `POST /api/sesiones` + WebSocket `/tiempo-real` (`modoConversacion: 'tiempoReal'`) |
| Progreso del estudiante | `GET /api/estudiante/progreso` (`usarDatosEjemploProgreso: false`) |
| Perfil docente: estudiantes, alertas, reportes, falencias, evolución, recomendaciones | `/api/docente/...` (`usarDatosEjemploDocente: false`, ver `js/servicios/docente/servicioDocenteApi.js`) |
| Enviar reporte a padres | Deshabilitado: pendiente de decisión del equipo |
| Audio del tutor (`respuesta.audioUrl`) | El backend envía `null`: se usa la voz del dispositivo. Pendiente acordar el formato del audio |

Para probar la interfaz sin backend, pon `modoConversacion: 'ejemplo'` y los dos `usarDatosEjemplo…` en `true`.

El micrófono necesita HTTPS o `localhost` en el navegador; en Android, el permiso `RECORD_AUDIO` ya está en el manifiesto.

## Estructura

```
frontend/
├── index.html               # contenedor único de la app
├── capacitor.config.json    # configuración de la app móvil
├── scripts/preparar-web.js  # copia la app a www/ (lo que se empaqueta en el APK)
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
│       └── estudiante/      # inicio, conversación con Thommy, lecciones, tema, progreso
└── pruebas/                 # mini marco de pruebas (Node y navegador)
```

### Agregar un perfil (por ejemplo, estudiante)

1. Crea sus pantallas en `js/perfiles/estudiante/pantallas/`.
2. Declara sus rutas en `js/perfiles/estudiante/rutas.js` con `perfil: 'estudiante'`.
3. Define su barra inferior en `js/perfiles/estudiante/navegacion.js` y usa `plantillaPantalla` de `js/componentes/`.

El enrutador ya protege cada ruta según el rol del token, y los componentes compartidos (encabezado, tarjetas, barras de progreso, gráficos, estados de carga y error) no dependen del perfil.
