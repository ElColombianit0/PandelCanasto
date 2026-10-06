import { pool } from "../config/db.js";

let productosColumnasVerificadas = false;

export async function asegurarColumnasProductos(db = pool) {
  const usaPoolDirecto = db === pool;

  if (usaPoolDirecto && productosColumnasVerificadas) return;

  await db.query(`
    ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS es_promocion BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS producto_base_id INTEGER,
    ADD COLUMN IF NOT EXISTS cantidad_base NUMERIC(12,3) NOT NULL DEFAULT 1
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS producto_componentes (
      id SERIAL PRIMARY KEY,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      componente_producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad NUMERIC(12,3) NOT NULL DEFAULT 1,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (usaPoolDirecto) {
    productosColumnasVerificadas = true;
  }
}
