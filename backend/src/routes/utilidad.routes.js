import express from "express";
import {
  datosBaseUtilidad,
  eliminarGastoFijo,
  eliminarGastoVariable,
  eliminarHoraExtra,
  guardarGastoFijo,
  guardarGastoVariable,
  guardarHoraExtra,
  listarGastosFijos,
  listarGastosVariables,
  listarHorasExtra,
  resumenUtilidad,
} from "../controllers/utilidad.controller.js";
import { verificarRol, verificarToken } from "../middlewares/auth.middleware.js";

const router = express.Router();
const soloAdmin = [verificarToken, verificarRol("ADMIN")];

router.get("/resumen", ...soloAdmin, resumenUtilidad);
router.get("/datos-base", ...soloAdmin, datosBaseUtilidad);

router.get("/gastos-fijos", ...soloAdmin, listarGastosFijos);
router.post("/gastos-fijos", ...soloAdmin, guardarGastoFijo);
router.put("/gastos-fijos/:id", ...soloAdmin, guardarGastoFijo);
router.delete("/gastos-fijos/:id", ...soloAdmin, eliminarGastoFijo);

router.get("/gastos", ...soloAdmin, listarGastosVariables);
router.post("/gastos", ...soloAdmin, guardarGastoVariable);
router.put("/gastos/:id", ...soloAdmin, guardarGastoVariable);
router.delete("/gastos/:id", ...soloAdmin, eliminarGastoVariable);

router.get("/horas-extra", ...soloAdmin, listarHorasExtra);
router.post("/horas-extra", ...soloAdmin, guardarHoraExtra);
router.put("/horas-extra/:id", ...soloAdmin, guardarHoraExtra);
router.delete("/horas-extra/:id", ...soloAdmin, eliminarHoraExtra);

export default router;
