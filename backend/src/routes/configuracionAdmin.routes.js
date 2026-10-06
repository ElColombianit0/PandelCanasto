import express from "express";
import {
  listarCostosVariablesAdmin,
  actualizarCostoVariableAdmin,
  listarSucursales,
  crearSucursal,
  actualizarSucursal,
  eliminarSucursal,
  listarGastos,
  guardarGasto,
  actualizarGasto,
  eliminarGasto,
  listarHorasExtra,
  guardarHoraExtra,
  actualizarHoraExtra,
  eliminarHoraExtra,
  resumenUtilidad,
} from "../controllers/configuracionAdmin.controller.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";

const router = express.Router();
const soloAdmin = [verificarToken, verificarRol("ADMIN")];

router.get("/costos", ...soloAdmin, listarCostosVariablesAdmin);
router.put("/costos/:id", ...soloAdmin, actualizarCostoVariableAdmin);

router.get("/sucursales", ...soloAdmin, listarSucursales);
router.post("/sucursales", ...soloAdmin, crearSucursal);
router.put("/sucursales/:id", ...soloAdmin, actualizarSucursal);
router.delete("/sucursales/:id", ...soloAdmin, eliminarSucursal);

router.get("/gastos", ...soloAdmin, listarGastos);
router.post("/gastos", ...soloAdmin, guardarGasto);
router.put("/gastos/:id", ...soloAdmin, actualizarGasto);
router.delete("/gastos/:id", ...soloAdmin, eliminarGasto);

router.get("/horas-extra", ...soloAdmin, listarHorasExtra);
router.post("/horas-extra", ...soloAdmin, guardarHoraExtra);
router.put("/horas-extra/:id", ...soloAdmin, actualizarHoraExtra);
router.delete("/horas-extra/:id", ...soloAdmin, eliminarHoraExtra);

router.get("/utilidad", ...soloAdmin, resumenUtilidad);

export default router;
