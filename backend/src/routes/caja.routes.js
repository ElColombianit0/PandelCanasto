import { Router } from "express";
import {
  obtenerCierreCaja,
  crearGastoCaja,
  actualizarGastoCaja,
  eliminarGastoCaja,
  obtenerEtiquetasCaja,
  crearEtiquetaCaja,
  obtenerHistorialGastos,
  obtenerHistorialGeneral,
  crearGastoGeneral,
  actualizarGastoGeneral,
  eliminarGastoGeneral,
} from "../controllers/caja.controller.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verificarToken, verificarRol("ADMIN"), obtenerCierreCaja);
router.post("/gastos", verificarToken, verificarRol("ADMIN"), crearGastoCaja);
router.put("/gastos/:id", verificarToken, verificarRol("ADMIN"), actualizarGastoCaja);
router.delete("/gastos/:id", verificarToken, verificarRol("ADMIN"), eliminarGastoCaja);
router.get("/etiquetas", verificarToken, verificarRol("ADMIN"), obtenerEtiquetasCaja);
router.post("/etiquetas", verificarToken, verificarRol("ADMIN"), crearEtiquetaCaja);
router.get("/gastos/historial", verificarToken, verificarRol("ADMIN"), obtenerHistorialGastos);
router.get("/general", verificarToken, verificarRol("ADMIN"), obtenerHistorialGeneral);
router.post("/general", verificarToken, verificarRol("ADMIN"), crearGastoGeneral);
router.put("/general/:id", verificarToken, verificarRol("ADMIN"), actualizarGastoGeneral);
router.delete("/general/:id", verificarToken, verificarRol("ADMIN"), eliminarGastoGeneral);

export default router;
