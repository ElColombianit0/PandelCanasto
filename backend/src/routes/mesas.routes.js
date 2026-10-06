import express from "express";

import {
  obtenerMesas,
  crearMesa,
  actualizarMesa,
  eliminarMesa,
} from "../controllers/mesas.controller.js";

import {
  verificarToken,
  verificarRol,
} from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get(
  "/",
  verificarToken,
  verificarRol("ADMIN", "EMPLEADO"),
  obtenerMesas
);

router.post(
  "/",
  verificarToken,
  verificarRol("ADMIN"),
  crearMesa
);

router.put(
  "/:id",
  verificarToken,
  verificarRol("ADMIN"),
  actualizarMesa
);

router.delete(
  "/:id",
  verificarToken,
  verificarRol("ADMIN"),
  eliminarMesa
);

export default router;
