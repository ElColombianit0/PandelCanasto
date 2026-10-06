import { readFile } from "node:fs/promises";
import { pool } from "../config/db.js";
import { asegurarTablasOperaciones } from "./operacionesSchema.js";

let esquemaEnCurso = null;

export function asegurarEsquemaCaja() {
  if (!esquemaEnCurso) {
    esquemaEnCurso = crearEsquemaCaja().catch((error) => {
      esquemaEnCurso = null;
      throw error;
    });
  }
  return esquemaEnCurso;
}

async function crearEsquemaCaja() {
  await asegurarTablasOperaciones();
  const migracion = await readFile(
    new URL("../../sql/20261006_caja_etiquetas_general.sql", import.meta.url),
    "utf8",
  );
  const client = await pool.connect();
  try {
    await client.query(migracion);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
