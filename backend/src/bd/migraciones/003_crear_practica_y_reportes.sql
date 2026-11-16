-- Práctica con Thommy y datos para los reportes de progreso.
-- El audio NO se guarda: vive en memoria solo durante el turno (según el Acta).

-- Docente a cargo de cada estudiante (se asigna con: npm run asignar-docente)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS docente_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_docente ON usuarios (docente_id);

-- Una fila por conversación con Thommy
CREATE TABLE IF NOT EXISTS sesiones_practica (
  id             SERIAL PRIMARY KEY,
  estudiante_id  INTEGER     NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  -- NULL = conversación libre
  tema_id        INTEGER     REFERENCES temas (id) ON DELETE SET NULL,
  frase_inicial  TEXT,
  iniciada_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sesiones_estudiante ON sesiones_practica (estudiante_id, iniciada_en);

-- Resultado de cada turno del estudiante. Los reportes se calculan a partir de esta tabla.
CREATE TABLE IF NOT EXISTS resultados_turno (
  id                     SERIAL PRIMARY KEY,
  sesion_id              INTEGER      NOT NULL REFERENCES sesiones_practica (id) ON DELETE CASCADE,
  transcripcion          TEXT         NOT NULL,
  -- Frase contra la que se comparó la pronunciación
  referencia             TEXT         NOT NULL,
  puntaje_pronunciacion  SMALLINT     NOT NULL CHECK (puntaje_pronunciacion BETWEEN 0 AND 100),
  puntaje_vocabulario    SMALLINT     NOT NULL CHECK (puntaje_vocabulario BETWEEN 0 AND 100),
  puntaje_gramatica      SMALLINT     NOT NULL CHECK (puntaje_gramatica BETWEEN 0 AND 100),
  puntaje_fluidez        SMALLINT     NOT NULL CHECK (puntaje_fluidez BETWEEN 0 AND 100),
  -- [{ texto, correcta, sugerencia? }] y [{ tipo, original, correccion, explicacion }]
  palabras               JSONB        NOT NULL DEFAULT '[]',
  errores                JSONB        NOT NULL DEFAULT '[]',
  respuesta_tutor        TEXT         NOT NULL,
  frase_siguiente        TEXT,
  latencia_ms            INTEGER,
  creado_en              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resultados_sesion ON resultados_turno (sesion_id, creado_en);

-- Recomendaciones del docente para el reporte de cada estudiante
CREATE TABLE IF NOT EXISTS recomendaciones (
  id             SERIAL PRIMARY KEY,
  estudiante_id  INTEGER      NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  docente_id     INTEGER      NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  texto          VARCHAR(140) NOT NULL,
  incluida       BOOLEAN      NOT NULL DEFAULT TRUE,
  -- FALSE = sugerida por el sistema a partir de las falencias; TRUE = escrita por el docente
  propia         BOOLEAN      NOT NULL DEFAULT FALSE,
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recomendaciones_estudiante ON recomendaciones (estudiante_id, docente_id);
