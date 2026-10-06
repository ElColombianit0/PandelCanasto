import dotenv from "dotenv";
import app from "./app.js";
import { probarConexionDB } from "./config/db.js";
import { asegurarEsquemaDB } from "./config/schema.js";

dotenv.config();

const PORT = process.env.PORT || 4000;

async function main() {
  try {
    await probarConexionDB();
    await asegurarEsquemaDB();
    console.log("PostgreSQL conectado correctamente");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`API corriendo en http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Error iniciando servidor:", error);
    process.exit(1);
  }
}

main();
