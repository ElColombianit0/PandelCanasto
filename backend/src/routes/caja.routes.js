import { Router } from "express";
import {
  obtenerCierreCaja,
  crearGastoCaja,
  actualizarGastoCaja,
  eliminarGastoCaja,
} from "../controllers/caja.controller.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verificarToken, verificarRol("ADMIN"), obtenerCierreCaja);
router.post("/gastos", verificarToken, verificarRol("ADMIN"), crearGastoCaja);
router.put("/gastos/:id", verificarToken, verificarRol("ADMIN"), actualizarGastoCaja);
router.delete("/gastos/:id", verificarToken, verificarRol("ADMIN"), eliminarGastoCaja);

export default router;
