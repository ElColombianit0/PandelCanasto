import express from "express";

import {
  listarInventario,
  crearInventario,
  actualizarInventario,
  agregarStockInventario,
  eliminarInventario,
  movimientosInventario,
  historialCostosInventario,
  datosBaseInventario,
  crearCategoriaInventario,
} from "../controllers/inventario.controller.js";

import {
  verificarToken,
  verificarRol,
} from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get(
  "/datos-base",
  verificarToken,
  verificarRol("ADMIN"),
  datosBaseInventario
);

router.post(
  "/categorias",
  verificarToken,
  verificarRol("ADMIN"),
  crearCategoriaInventario
);

router.get(
  "/",
  verificarToken,
  verificarRol("ADMIN"),
  listarInventario
);

router.post(
  "/",
  verificarToken,
  verificarRol("ADMIN"),
  crearInventario
);

router.put(
  "/:id",
  verificarToken,
  verificarRol("ADMIN"),
  actualizarInventario
);

router.patch(
  "/:id/agregar-stock",
  verificarToken,
  verificarRol("ADMIN"),
  agregarStockInventario
);

router.delete(
  "/:id",
  verificarToken,
  verificarRol("ADMIN"),
  eliminarInventario
);

router.get(
  "/:id/movimientos",
  verificarToken,
  verificarRol("ADMIN"),
  movimientosInventario
);

router.get(
  "/:id/historial-costos",
  verificarToken,
  verificarRol("ADMIN"),
  historialCostosInventario
);

export default router;
