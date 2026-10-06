BEGIN;

CREATE TABLE IF NOT EXISTS caja_etiquetas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL CHECK (length(btrim(nombre)) > 0),
  creado_en TIMESTAMP NOT NULL DEFAULT timezone('America/Bogota', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_caja_etiquetas_nombre
ON caja_etiquetas (lower(btrim(nombre)));

ALTER TABLE caja_gastos
  ADD COLUMN IF NOT EXISTS etiqueta_id INTEGER REFERENCES caja_etiquetas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comentario TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reintegrado BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_caja_gastos_fecha ON caja_gastos (fecha);
CREATE INDEX IF NOT EXISTS idx_caja_gastos_etiqueta_fecha ON caja_gastos (etiqueta_id, fecha);

-- Este historico no participa en los cierres ni en las utilidades netas.
CREATE TABLE IF NOT EXISTS caja_general_gastos (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  descripcion TEXT NOT NULL,
  monto NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  metodo_salida VARCHAR(30) NOT NULL DEFAULT 'EFECTIVO',
  etiqueta_id INTEGER REFERENCES caja_etiquetas(id) ON DELETE SET NULL,
  comentario TEXT NOT NULL DEFAULT '',
  reintegrado BOOLEAN NOT NULL DEFAULT false,
  usuario_id INTEGER REFERENCES usuarios(id),
  creado_en TIMESTAMP NOT NULL DEFAULT timezone('America/Bogota', now())
);

CREATE INDEX IF NOT EXISTS idx_caja_general_gastos_fecha ON caja_general_gastos (fecha);
CREATE INDEX IF NOT EXISTS idx_caja_general_gastos_etiqueta_fecha
ON caja_general_gastos (etiqueta_id, fecha);

COMMIT;
