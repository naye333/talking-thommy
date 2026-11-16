# Medición de calidad · Transcripción, pronunciación y latencia

Este procedimiento produce la evidencia de los criterios de calidad de `ESTANDARES_Talking_Thommy.md` (secciones 4, 5 y 8) para la transcripción, el análisis fonético y la latencia del audio. Los valores objetivo los fija el documento oficial de métricas del equipo; este procedimiento solo los mide.

## 1. Grabar los audios

1. Elijan entre 15 y 30 frases modelo del syllabus (`backend/src/bd/semillas/syllabus-ingles-*.json`), de varios temas.
2. Pidan a **al menos 3 estudiantes** que graben cada frase con el celular, en un lugar normal (no un estudio). Sirven formatos `m4a`, `webm`, `ogg`, `wav` o `mp3`.
3. Pongan los audios en una carpeta **fuera del repositorio** (contienen voces de personas) y creen allí `casos.json`:

```json
[
  { "audio": "ana-frase01.m4a", "texto": "Hi, let me introduce myself." },
  { "audio": "ana-frase02.m4a", "texto": "I am friendly and funny." },
  { "audio": "luis-frase01.m4a", "texto": "Hi, let me introduce myself." }
]
```

`texto` es lo que el estudiante debía decir.

## 2. Ejecutar la medición

Con `GROQ_API_KEY` configurada en `backend/.env`:

```bash
cd backend
npm run medir-calidad -- C:/ruta/a/la/carpeta
```

Agreguen `--con-tutor` para medir también la respuesta de Thommy (latencia completa del turno). Gasta más cuota de Groq.

## 3. Qué se obtiene

El script muestra cada caso y guarda `reporte-calidad-AAAA-MM-DD.json` en la carpeta, con:

| Métrica | Significado |
|---|---|
| `werPromedio` | Tasa de error de palabras de la transcripción (0 = perfecta; 0,10 = 1 de cada 10 palabras mal) |
| `casosSinErrores` | Casos transcritos sin ningún error |
| `puntajePronunciacionPromedio` | Puntaje del análisis fonético frente a la frase esperada |
| `latenciaMs.p50` / `p95` / `maxima` | Tiempo de respuesta: la mitad de los casos tarda menos que p50, y el 95 % menos que p95 |

En uso real, cada turno también guarda su latencia en `resultados_turno.latencia_ms`. Para consultarla en el SQL Editor de Neon:

```sql
SELECT count(*) AS turnos,
       percentile_cont(0.5)  WITHIN GROUP (ORDER BY latencia_ms) AS p50_ms,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY latencia_ms) AS p95_ms
FROM resultados_turno
WHERE creado_en > NOW() - INTERVAL '7 days';
```

## 4. Cómo interpretar y registrar

- **Transcripción:** un WER alto en audios bien pronunciados indica problemas de ruido o de micrófono, no del estudiante.
- **Análisis fonético:** revisen a mano 5-10 casos con puntaje bajo. Escuchen el audio y confirmen que la palabra marcada sí estaba mal pronunciada (coherencia con el audio). Registren los falsos positivos.
- **Latencia:** comparen `p95` con el valor de las métricas oficiales.
- Guarden el reporte JSON y una tabla resumen como evidencia del sprint (Definition of Done, punto 9).

> Limitación conocida: el análisis compara lo que Whisper entendió con la frase esperada. Si Whisper corrige un error de pronunciación al transcribir, ese error no se detecta.
