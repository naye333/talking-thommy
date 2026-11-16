# Historias de usuario · Talking Thommy

Historias implementadas, con sus criterios de aceptación y dónde verificarlas. Relacionadas con los módulos del Acta de Constitución (sección 4). La validación final con el profesor Jhoan Segura queda pendiente.

| ID | Historia | Módulo del Acta | Estado |
|---|---|---|---|
| HU01 | Registro e ingreso | Datos | Implementada |
| HU02 | Consultar el syllabus | Syllabus | Implementada (solo Inglés I) |
| HU03 | Conversar con Thommy | Tutor IA | Implementada |
| HU04 | Transcripción y análisis de pronunciación | Pronunciación | Implementada |
| HU05 | Retroalimentación del turno | Retroalimentación | Implementada |
| HU06 | Progreso del estudiante | Analítica | Implementada |
| HU07 | Grupo del docente | Datos | Implementada |
| HU08 | Reporte y falencias de un estudiante | Analítica | Implementada |
| HU09 | Recomendaciones del docente | Retroalimentación | Implementada |
| HU10 | Gestión de la contraseña | Datos | Implementada |
| HU11 | Enviar reporte a padres | Analítica | Pendiente de decisión |

---

### HU01 · Registro e ingreso
**Como** estudiante de Inglés I o II, **quiero** crear mi cuenta e ingresar, **para** practicar con mi propio historial.

- Dado un correo nuevo, una contraseña de 8 a 72 caracteres y el nivel 1 o 2, cuando me registro, entonces entro a la app como estudiante.
- Dado un correo ya registrado, cuando me registro, entonces veo "Ese correo ya está registrado".
- Dadas credenciales incorrectas, cuando ingreso, entonces veo "Correo o contraseña incorrectos" sin saber cuál de los dos falló.
- Dados 10 intentos fallidos en 15 minutos, cuando intento de nuevo, entonces se bloquea temporalmente (`DEMASIADOS_INTENTOS`).
- El registro público nunca crea docentes.

**Evidencia:** `backend/pruebas/autenticacion.test.js`, `cuentas.test.js`.

### HU02 · Consultar el syllabus
**Como** estudiante, **quiero** ver los temas de mi curso, **para** elegir qué practicar.

- Veo las unidades y temas de mi nivel, en orden, con su objetivo, gramática, vocabulario y frases modelo.
- El syllabus no se puede editar desde la app (exclusión del Acta).

**Evidencia:** `backend/pruebas/syllabus.test.js`.

### HU03 · Conversar con Thommy
**Como** estudiante, **quiero** hablar en inglés con un tutor sobre un tema del syllabus, **para** practicar expresión oral entre clases.

- Al iniciar una práctica de un tema, Thommy me saluda y me propone una frase modelo del tema.
- Después de cada turno, Thommy responde en inglés sencillo y propone la siguiente frase.
- Thommy se mantiene en el tema y no presenta su resultado como nota oficial.
- También existe la conversación libre (sin tema).

**Evidencia:** `backend/pruebas/servicioTutor.test.js`, `practica.test.js`, `tiempoReal.test.js`.

### HU04 · Transcripción y análisis de pronunciación
**Como** estudiante, **quiero** que la app entienda lo que digo y compare mi pronunciación con una referencia, **para** saber qué palabras debo mejorar.

- Mi audio se transcribe y se muestra lo que la app entendió.
- Cada palabra de la frase de referencia aparece como correcta o por practicar.
- Una palabra mal pronunciada indica qué se escuchó y qué sonido cuidar.
- El audio no se guarda: solo vive en memoria durante el turno.

**Evidencia:** `backend/pruebas/analisisFonetico.test.js`, `procesadorTurno.test.js`, `docs/metricas-calidad.md`.

### HU05 · Retroalimentación del turno
**Como** estudiante, **quiero** recibir un puntaje y un mensaje claro en español, **para** entender cómo me fue.

- Recibo un puntaje de 0 a 100 y un nivel: excelente (≥ 85), bien (≥ 65) o practicar.
- El mensaje nombra las palabras a practicar y, si cometí un error gramatical, una explicación breve.

**Evidencia:** `backend/pruebas/servicioEvaluacion.test.js`.

### HU06 · Progreso del estudiante
**Como** estudiante, **quiero** ver mi progreso por semana, mes o semestre, **para** saber si estoy mejorando.

- Veo el promedio general, la variación frente al periodo anterior y el puntaje de pronunciación, vocabulario, gramática y fluidez.
- Veo la evolución en 7 puntos, mis fortalezas y las áreas a mejorar.
- Sin práctica en el periodo, los valores aparecen en 0.

**Evidencia:** `backend/pruebas/servicioReportes.test.js`, `practica.test.js`.

### HU07 · Grupo del docente
**Como** docente, **quiero** que mis estudiantes se unan a mi grupo con un código, **para** ver solo su progreso.

- Veo mi código de grupo de 6 caracteres en Configuración y puedo generar uno nuevo.
- El estudiante escribe el código al registrarse o en su perfil y queda en mi grupo.
- Un código inexistente muestra "No existe un grupo con ese código".
- El docente solo ve a los estudiantes de su grupo.

**Evidencia:** `backend/pruebas/cuentas.test.js`, `docente.test.js`.

### HU08 · Reporte y falencias de un estudiante
**Como** docente, **quiero** ver el reporte, la evolución y las falencias de cada estudiante, **para** acompañarlo en lo que más le cuesta.

- Veo la lista de mis estudiantes con su promedio y variación, y puedo buscarlos por nombre (sin importar tildes).
- Veo alertas de estudiantes con promedio menor a 65 % o que bajaron su rendimiento.
- En las falencias veo, por área, el tema del syllabus donde peor le va y una descripción concreta.
- Si consulto a un estudiante que no es de mi grupo, recibo "No encontramos a ese estudiante".

**Evidencia:** `backend/pruebas/docente.test.js`.

### HU09 · Recomendaciones del docente
**Como** docente, **quiero** sugerir actividades de refuerzo, **para** incluirlas en el reporte del estudiante.

- La primera vez veo sugerencias generadas a partir de las falencias.
- Puedo agregar sugerencias propias (máximo 140 caracteres), incluirlas o excluirlas del reporte y eliminarlas.

**Evidencia:** `backend/pruebas/docente.test.js`, `frontend/pruebas/casos/servicioDocenteApi.prueba.js`.

### HU10 · Gestión de la contraseña
**Como** usuario, **quiero** cambiar mi contraseña o recuperarla si la olvido, **para** no perder el acceso.

- En Configuración cambio mi contraseña escribiendo la actual y la nueva dos veces.
- Si un estudiante la olvida, su docente genera una contraseña temporal desde "Acciones".
- Si el docente la olvida, se restablece con `npm run restablecer-contrasena`.

**Evidencia:** `backend/pruebas/cuentas.test.js`, `frontend/pruebas/casos/cuenta.prueba.js`.

### HU11 · Enviar reporte a padres (pendiente)
Los estudiantes son universitarios y no hay datos de acudientes. Se debe decidir con el profesor si se elimina o si el reporte se envía al propio estudiante. El botón está deshabilitado.
