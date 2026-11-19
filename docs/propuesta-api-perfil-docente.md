# Propuesta de API · Perfil docente

> **Estado: propuesta pendiente de aprobación.** Nada de esto existe aún en el backend. El frontend usa datos de ejemplo con esta misma forma (`frontend/js/servicios/docente/servicioDocente.js`). Cuando se implemente, solo cambia ese archivo.

Todas las rutas exigen `Authorization: Bearer <token>` y el rol `docente` (`exigirToken, exigirRol('docente')`). Los errores siguen el formato actual `{ error, detalles? }`.

## Datos que faltan en la base de datos

| Tabla | Para qué |
|---|---|
| `grupos` y `grupo_estudiantes` (o `docente_id` en `usuarios`) | Saber qué estudiantes pertenecen a cada docente |
| `sesiones_practica` | Una fila por sesión con Thommy (estudiante, tema, fecha) |
| `resultados_turno` | Puntajes por área de cada turno: `pronunciacion`, `vocabulario`, `gramatica`, `fluidez` (0-100) |
| `recomendaciones` | `estudiante_id`, `docente_id`, `texto`, `incluida`, `propia`, `creado_en` |

Los reportes se calculan a partir de `resultados_turno`; no se guardan aparte.

## Endpoints

`periodo` ∈ `ultima_semana` · `ultimo_mes` (por defecto) · `semestre`.

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/docente/estudiantes?busqueda=` | `{ estudiantes: [{ id, nombre, nivel, promedioGeneral, variacion }] }` |
| GET | `/api/docente/alertas` | `{ alertas: [{ id, nombre, nivel, promedioGeneral, motivo }] }` |
| GET | `/api/docente/estudiantes/:id/reporte?periodo=` | `{ estudiante, periodo, promedioGeneral, variacion, areas: [{ clave, nombre, valor }] }` |
| GET | `/api/docente/estudiantes/:id/falencias` | `{ estudiante, falencias: [{ clave, area, tema, descripcion, porcentaje }] }` (de menor a mayor) |
| GET | `/api/docente/estudiantes/:id/detalle?periodo=` | `{ estudiante, periodo, evolucion: [{ etiqueta, valor }], fortalezas: [texto], areasMejorar: [texto] }` |
| GET | `/api/docente/estudiantes/:id/recomendaciones` | `{ estudiante, recomendaciones: [{ id, texto, incluida, propia }] }` |
| POST | `/api/docente/estudiantes/:id/recomendaciones` | Cuerpo `{ texto }` (1-140 caracteres) → `201 { recomendacion }` |
| PATCH | `/api/docente/estudiantes/:id/recomendaciones/:recId` | Cuerpo `{ incluida }` → `{ recomendacion }` |
| DELETE | `/api/docente/estudiantes/:id/recomendaciones/:recId` | `204` |

`estudiante` = `{ id, nombre, nivel }`. `variacion` es la diferencia en puntos frente al periodo anterior.

Nuevos códigos de error: `ESTUDIANTE_NO_ENCONTRADO` (404, también si el estudiante no es del docente), `RECOMENDACION_NO_ENCONTRADA` (404).

## Pendiente de decisión

- **Envío a padres:** no hay datos de padres y los estudiantes son universitarios. Hay que definir si se envía al estudiante, a un acudiente o si se elimina. El botón está deshabilitado (`capacidades.envioPadres = false`).
- **Alertas:** el criterio actual del ejemplo es promedio < 65 % o variación negativa. Debe validarlo el profesor.
- **Inglés II:** no existe su syllabus; los datos de ejemplo usan solo Inglés I.
