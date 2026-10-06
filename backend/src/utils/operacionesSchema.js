import { pool } from "../config/db.js";

let operacionesVerificadas = false;

export async function asegurarTablasOperaciones(db = pool) {
  const usaPoolDirecto = db === pool;

  if (usaPoolDirecto && operacionesVerificadas) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS caja_gastos (
      id SERIAL PRIMARY KEY,
      fecha DATE NOT NULL,
      descripcion TEXT NOT NULL,
      monto NUMERIC(14,2) NOT NULL,
      metodo_salida VARCHAR(30) NOT NULL DEFAULT 'EFECTIVO',
      usuario_id INTEGER REFERENCES usuarios(id),
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS bajas_inventario (
      id SERIAL PRIMARY KEY,
      inventario_id INTEGER NOT NULL REFERENCES inventario(id),
      usuario_id INTEGER REFERENCES usuarios(id),
      cantidad NUMERIC(14,3) NOT NULL,
      costo_unitario_momento NUMERIC(14,2) NOT NULL DEFAULT 0,
      costo_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      descripcion TEXT NOT NULL,
      fecha DATE NOT NULL,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    ALTER TABLE bajas_inventario
    ADD COLUMN IF NOT EXISTS costo_unitario_momento NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS costo_total NUMERIC(14,2) NOT NULL DEFAULT 0
  `);

  if (usaPoolDirecto) {
    operacionesVerificadas = true;
  }
}
