import express from "express";
import {
  actualizarCostoVariableAdmin,
  actualizarSucursal,
  crearSucursal,
  obtenerConfiguracionAdmin,
} from "../controllers/adminConfig.controller.js";
import { verificarRol, verificarToken } from "../middlewares/auth.middleware.js";

const router = express.Router();
const soloAdmin = [verificarToken, verificarRol("ADMIN")];

router.get("/", ...soloAdmin, obtenerConfiguracionAdmin);
router.put("/costos/:id", ...soloAdmin, actualizarCostoVariableAdmin);
router.post("/sucursales", ...soloAdmin, crearSucursal);
router.put("/sucursales/:id", ...soloAdmin, actualizarSucursal);

export default router;
