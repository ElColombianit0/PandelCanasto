import express from "express";
import cors from "cors";
import morgan from "morgan";

import categoriasRoutes from "./routes/categorias.routes.js";
import authRoutes from "./routes/auth.routes.js";
import productosRoutes from "./routes/productos.routes.js";
import mesasRoutes from "./routes/mesas.routes.js";
import configuracionFacturaRoutes from "./routes/configuracionFactura.routes.js";
import configuracionSitioRoutes from "./routes/configuracionSitio.routes.js";
import configuracionAdminRoutes from "./routes/configuracionAdmin.routes.js";
import pedidosRoutes from "./routes/pedidos.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import ventasRoutes from "./routes/ventas.routes.js";
import inventarioRoutes from "./routes/inventario.routes.js";
import recetasRoutes from "./routes/recetas.routes.js";
import reportesRoutes from "./routes/reportes.routes.js";
import cajaRoutes from "./routes/caja.routes.js";
import bajasInventarioRoutes from "./routes/bajasInventario.routes.js";
import { probarConexionDB } from "./config/db.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));
app.use("/api/categorias", categoriasRoutes);

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "API Pan del Canasto funcionando",
  });
});

app.get("/api", (req, res) => {
  res.json({
    ok: true,
    message: "API Pan del Canasto funcionando",
  });
});

app.get("/api/health/db", async (req, res) => {
  try {
    const db = await probarConexionDB();
    res.json({
      ok: true,
      message: "PostgreSQL conectado correctamente",
      db_time: db.now,
    });
  } catch (error) {
    console.error("Error verificando PostgreSQL:", error);
    res.status(500).json({
      ok: false,
      message: "No se pudo conectar a PostgreSQL",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/mesas", mesasRoutes);
app.use("/api/configuracion-factura", configuracionFacturaRoutes);
app.use("/api/configuracion-sitio", configuracionSitioRoutes);
app.use("/api/configuracion-admin", configuracionAdminRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/ventas", ventasRoutes);
app.use("/api/inventario", inventarioRoutes);
app.use("/api/recetas", recetasRoutes);
app.use("/api/reportes", reportesRoutes);
app.use("/api/caja", cajaRoutes);
app.use("/api/bajas-inventario", bajasInventarioRoutes);

export default app;
