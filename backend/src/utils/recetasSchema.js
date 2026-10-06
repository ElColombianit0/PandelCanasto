import { pool } from "../config/db.js";

let recetasColumnasVerificadas = false;

export async function asegurarColumnasRecetas(db = pool) {
  const usaPoolDirecto = db === pool;

  if (usaPoolDirecto && recetasColumnasVerificadas) return;

  await db.query(`
    ALTER TABLE recetas
    ADD COLUMN IF NOT EXISTS auto_preparar BOOLEAN NOT NULL DEFAULT FALSE
  `);

  if (usaPoolDirecto) {
    recetasColumnasVerificadas = true;
  }
}
