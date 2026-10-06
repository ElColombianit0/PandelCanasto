import { Router } from "express";
import {
  listarBajasInventario,
  crearBajaInventario,
  actualizarBajaInventario,
  eliminarBajaInventario,
} from "../controllers/bajasInventario.controller.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verificarToken, verificarRol("ADMIN"), listarBajasInventario);
router.post("/", verificarToken, verificarRol("ADMIN"), crearBajaInventario);
router.put("/:id", verificarToken, verificarRol("ADMIN"), actualizarBajaInventario);
router.delete("/:id", verificarToken, verificarRol("ADMIN"), eliminarBajaInventario);

export default router;
