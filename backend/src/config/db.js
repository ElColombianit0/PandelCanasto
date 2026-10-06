import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: "127.0.0.1",
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: process.env.DB_OPTIONS || "-c timezone=America/Bogota",
});

export async function probarConexionDB() {
  const result = await pool.query("SELECT NOW()");
  return result.rows[0];
}
