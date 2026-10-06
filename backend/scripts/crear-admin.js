import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { pool } from "../src/config/db.js";

dotenv.config();

const nombre = process.env.ADMIN_NOMBRE || "Administrador";
const email = process.env.ADMIN_EMAIL;
const documento = process.env.ADMIN_DOCUMENTO;
const password = process.env.ADMIN_PASSWORD;

async function main() {
  try {
    if (!email || !documento || !password) {
      throw new Error(
        "Define ADMIN_EMAIL, ADMIN_DOCUMENTO y ADMIN_PASSWORD en el entorno",
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO usuarios (
        nombre,
        email,
        documento,
        password_hash,
        rol,
        activo,
        creado_en,
        actualizado_en
      )
      VALUES ($1,$2,$3,$4,'ADMIN',true, timezone('America/Bogota', now()), timezone('America/Bogota', now()))
      ON CONFLICT (email) DO UPDATE
      SET
        nombre = EXCLUDED.nombre,
        documento = EXCLUDED.documento,
        password_hash = EXCLUDED.password_hash,
        rol = 'ADMIN',
        activo = true,
        actualizado_en = timezone('America/Bogota', now())
      RETURNING id, nombre, email, documento, rol
      `,
      [nombre, email, documento, passwordHash],
    );

    console.log("Administrador listo:", result.rows[0]);
  } catch (error) {
    console.error("Error creando administrador:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
