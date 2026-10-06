import express from "express";

import {
  listarEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  desactivarEmpleado,
} from "../controllers/usuarios.controller.js";

import {
  verificarToken,
  verificarRol,
} from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get(
  "/empleados",
  verificarToken,
  verificarRol("ADMIN"),
  listarEmpleados
);

router.post(
  "/empleados",
  verificarToken,
  verificarRol("ADMIN"),
  crearEmpleado
);

router.put(
  "/empleados/:id",
  verificarToken,
  verificarRol("ADMIN"),
  actualizarEmpleado
);

router.delete(
  "/empleados/:id",
  verificarToken,
  verificarRol("ADMIN"),
  desactivarEmpleado
);

export default router;
