import express from "express";

import {
  listarVentas,
  obtenerVenta,
  anularVenta,
  actualizarDetalleVenta,
  auditoriaVenta,
} from "../controllers/ventas.controller.js";

import {
  verificarToken,
  verificarRol,
} from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get(
  "/",
  verificarToken,
  verificarRol("ADMIN"),
  listarVentas
);

router.get(
  "/:id",
  verificarToken,
  verificarRol("ADMIN"),
  obtenerVenta
);

router.get(
  "/:id/auditoria",
  verificarToken,
  verificarRol("ADMIN"),
  auditoriaVenta
);

router.patch(
  "/:id/anular",
  verificarToken,
  verificarRol("ADMIN"),
  anularVenta
);

router.patch(
  "/:id/detalles",
  verificarToken,
  verificarRol("ADMIN"),
  actualizarDetalleVenta
);

export default router;
