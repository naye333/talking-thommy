-- Usuarios de Talking Thommy: estudiantes de Inglés I/II y docentes
CREATE TABLE IF NOT EXISTS usuarios (
  id               SERIAL PRIMARY KEY,
  nombre           VARCHAR(100) NOT NULL,
  correo           VARCHAR(150) NOT NULL UNIQUE,
  hash_contrasena  VARCHAR(100) NOT NULL,
  rol              VARCHAR(20)  NOT NULL DEFAULT 'estudiante'
                   CHECK (rol IN ('estudiante', 'docente')),
  nivel            SMALLINT     CHECK (nivel IN (1, 2)),
  creado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Los estudiantes deben tener nivel; los docentes no
  CONSTRAINT nivel_segun_rol CHECK (
    (rol = 'estudiante' AND nivel IS NOT NULL) OR rol = 'docente'
  )
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios (rol);
