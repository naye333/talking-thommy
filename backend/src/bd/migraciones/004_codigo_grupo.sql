-- Código de grupo del docente: el estudiante lo escribe al registrarse (o en su perfil)
-- para quedar asignado a ese docente sin usar la terminal.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS codigo_grupo VARCHAR(12) UNIQUE;

-- Los docentes que ya existían reciben un código de 6 caracteres (sin 0 ni 1, que se confunden con O e I)
UPDATE usuarios
   SET codigo_grupo = translate(upper(substr(md5(random()::text || id::text), 1, 6)), '01', 'GH')
 WHERE rol = 'docente' AND codigo_grupo IS NULL;
