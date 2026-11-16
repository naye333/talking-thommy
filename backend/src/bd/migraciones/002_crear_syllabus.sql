-- Syllabus de Inglés I y II: unidades y temas de práctica.
-- El contenido se carga con: npm run sembrar-syllabus (no se edita desde la app, según el Acta).

CREATE TABLE IF NOT EXISTS unidades_syllabus (
  id           SERIAL PRIMARY KEY,
  nivel        SMALLINT     NOT NULL CHECK (nivel IN (1, 2)),
  numero       SMALLINT     NOT NULL CHECK (numero > 0),
  titulo       VARCHAR(150) NOT NULL,
  descripcion  TEXT,
  CONSTRAINT unidad_unica_por_nivel UNIQUE (nivel, numero)
);

CREATE TABLE IF NOT EXISTS temas (
  id             SERIAL PRIMARY KEY,
  unidad_id      INTEGER      NOT NULL REFERENCES unidades_syllabus (id) ON DELETE CASCADE,
  numero         SMALLINT     NOT NULL CHECK (numero > 0),
  -- Semana del semestre en que se ve el tema según la planeación de clase
  semana         SMALLINT     CHECK (semana BETWEEN 1 AND 20),
  titulo         VARCHAR(150) NOT NULL,
  objetivo       TEXT         NOT NULL,
  gramatica      TEXT[]       NOT NULL DEFAULT '{}',
  -- Palabras clave del tema, base del análisis de pronunciación
  vocabulario    TEXT[]       NOT NULL DEFAULT '{}',
  -- Frases modelo que el tutor usa para conversar y como referencia fonética
  frases_modelo  TEXT[]       NOT NULL DEFAULT '{}',
  CONSTRAINT tema_unico_por_unidad UNIQUE (unidad_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_temas_unidad ON temas (unidad_id);
