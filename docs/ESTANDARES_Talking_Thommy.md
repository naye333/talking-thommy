# Talking Thommy: Tutor Conversacional con IA para la Práctica de Inglés

# 

# Alisson Daniela Romero Cano

# Sheila Nayeli Torres Berrio

# Gerencia de Software

# Ingeniera Leidy Stefany Gómez Riveros

# Facultad de Ingeniería de Sistemas

# Universidad Santo Tomás

# Villavicencio, Colombia

# 2026

#  

# 1. Propósito

Este documento establece los estándares que regirán el desarrollo del proyecto Talking Thommy durante el semestre. Su objetivo es asegurar que el trabajo del equipo sea consistente, verificable, mantenible y alineado con el Acta de Constitución y con los criterios de calidad definidos para el proyecto.

# 2. Guía de estilo y nomenclatura

El equipo adoptará Prettier como formateador de código, cuando la tecnología utilizada lo permita. La configuración deberá estar disponible en el repositorio para que todos los integrantes trabajen con los mismos criterios de formato.

Idioma para el código: español para la documentación y textos dirigidos al usuario; inglés para nombres técnicos del código, siguiendo las convenciones del lenguaje utilizado.

- **Variables y funciones:** camelCase. Ejemplo: obtenerTranscripcion().

- **Clases y componentes:** PascalCase. Ejemplo: AnalizadorFonetic.

- **Constantes:** UPPER_SNAKE_CASE. Ejemplo: MAX_INTENTOS.

# 3. Convención de commits y ramas

Los mensajes de commit utilizarán el formato:

**tipo: descripción breve**

Tipos permitidos:

- feat: nueva funcionalidad

- fix: corrección de un error

- docs: cambios de documentación

- test: creación o modificación de pruebas

- refactor: reorganización del código sin cambiar su comportamiento

- chore: tareas de mantenimiento o configuración

Convención de ramas:

- main: versión estable del proyecto.

- develop: integración del trabajo del equipo.

- feature/\<nombre\>: desarrollo de una funcionalidad.

- fix/\<nombre\>: corrección de un error.

# 4. Estándares de calidad del proyecto

La calidad de Talking Thommy se verificará considerando las funciones y riesgos definidos para el proyecto. Los criterios principales son:

- Funcionalidad: las funciones implementadas deben cumplir los requisitos y criterios de aceptación.

- Transcripción: la conversión de voz a texto debe ser adecuada para el propósito de práctica oral.

- Análisis fonético y pronunciación: los resultados deben ser coherentes con la entrada de audio y útiles para el aprendizaje.

- Pertinencia de la retroalimentación: las observaciones entregadas por el sistema deben estar relacionadas con el desempeño del estudiante.

- Rendimiento y latencia de audio: el procesamiento debe ejecutarse dentro de los valores de calidad definidos para el proyecto.

- Usabilidad: las funciones deben poder utilizarse de forma clara y comprensible.

- Estabilidad y manejo de errores: los errores deben gestionarse sin producir fallos innecesarios del sistema.

- Calidad y mantenibilidad del código: el código debe respetar las convenciones acordadas y facilitar su revisión y evolución.

# 5. Relación con las métricas de calidad

Las métricas de calidad del proyecto deberán utilizarse como evidencia para verificar los estándares. Los valores numéricos exactos deberán corresponder al documento oficial de métricas de calidad del proyecto; este documento de estándares no inventa ni modifica dichos valores.

| Aspecto           | Evidencia esperada                                                                        |
|-------------------|-------------------------------------------------------------------------------------------|
| Transcripción     | Resultado de transcripción y verificación frente al criterio de calidad correspondiente.  |
| Análisis fonético | Resultado del análisis y comprobación de su coherencia con el audio.                      |
| Retroalimentación | Verificación de que el feedback sea pertinente al desempeño.                              |
| Latencia de audio | Medición del tiempo de procesamiento frente al valor definido por las métricas oficiales. |

# 6. Definition of Ready (Definición de Listo)

Una tarea podrá comenzar cuando cumpla todas las siguientes condiciones:

1.  El requerimiento está claramente definido.

2.  Los criterios de aceptación están escritos y son verificables.

3.  La tarea tiene relación identificable con los objetivos o funciones de Talking Thommy.

4.  Las dependencias necesarias están identificadas.

5.  Está definido qué evidencia permitirá comprobar la calidad o cumplimiento de la tarea.

# 7. Definition of Done (Definición de Terminado)

Una tarea se considerará terminada únicamente cuando:

6.  Cumple todos los criterios de aceptación definidos.

7.  El código respeta las convenciones de estilo y nomenclatura del equipo.

8.  Las pruebas aplicables fueron ejecutadas y sus resultados son satisfactorios.

9.  Se verificó la métrica de calidad aplicable, cuando corresponda.

10. Se verificó el manejo de errores asociado a la funcionalidad.

11. La documentación necesaria fue actualizada.

12. La implementación fue revisada por al menos otro integrante del equipo.

13. Los cambios quedaron correctamente integrados en la rama correspondiente.

# 8. Estándares para las funciones principales de Talking Thommy

- **Tutor conversacional:** La conversación debe responder al propósito de práctica de inglés y mantenerse dentro del alcance definido para el proyecto.

- **Captura de voz y transcripción:** La entrada de audio debe procesarse correctamente y la transcripción debe poder verificarse mediante la evidencia definida.

- **Análisis fonético y pronunciación:** El análisis debe corresponder al audio recibido y producir información útil para la práctica oral.

- **Retroalimentación:** El feedback debe ser claro, pertinente y relacionado con el desempeño observado.

- **Rendimiento y latencia:** El procesamiento de audio debe medirse cuando la tarea lo requiera y compararse con la métrica oficial aplicable.

- **Analítica y progreso:** Los resultados registrados deben corresponder a las actividades realizadas por el estudiante y permitir verificar su evolución.

# 9. Política de revisión

- Quién revisa: toda modificación relevante deberá ser revisada por otro integrante diferente de quien la implementó.

- Plazo: cuando el flujo de trabajo lo permita, la revisión deberá realizarse en un máximo de 24 horas.

- Bloqueadores: incumplimiento de criterios de aceptación, fallos funcionales, incumplimiento de una métrica aplicable, errores críticos de transcripción, análisis fonético incorrecto, retroalimentación no pertinente, pruebas fallidas, violaciones de estándares o conflictos de integración sin resolver.

- No bloqueadores: mejoras opcionales, ajustes menores de documentación o trabajo que no sea necesario para cumplir el objetivo actual.

- Comentarios: deben ser claros, respetuosos, específicos y orientados a una solución. Los comentarios que impidan aprobar o integrar el cambio deberán identificarse explícitamente como bloqueadores.

# 10. Evidencia verificable

Cada acuerdo de este documento debe poder comprobarse mediante evidencia observable por una persona que no haya participado en la decisión. Como evidencia se podrán utilizar, según corresponda: historial de commits, ramas del repositorio, código, resultados de pruebas, mediciones de calidad, registros de ejecución, capturas, documentación y revisiones de código.

# 11. Gestión de cambios a los estándares

Cualquier modificación a estos estándares deberá ser acordada por el equipo, registrada en el repositorio y documentada mediante un commit que permita identificar el cambio. Las modificaciones deberán conservar la trazabilidad de la versión anterior.

# 12. Aceptación

Cada integrante debe escribir su nombre completo y declarar literalmente:

Nombre completo: Sheila Nayeli Torres Berrio  
conozco y acepto estos estándares

Nombre completo: Alisson Daniela Romero Cano  
conozco y acepto estos estándares

Nota: completar esta sección con el nombre completo de cada integrante del equipo antes de publicar la versión definitiva.

# 13. Control del documento

| Documento | ESTANDARES.md / Documento de estándares |
|-----------|-----------------------------------------|
| Proyecto  | Talking Thommy                          |
| Versión   | 1.0                                     |
| Idioma    | Español                                 |
