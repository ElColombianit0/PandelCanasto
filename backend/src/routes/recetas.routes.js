import express from "express";

import {
  listarRecetas,
  crearReceta,
  actualizarReceta,
  eliminarReceta,
  detalleReceta,
  agregarIngrediente,
  actualizarIngrediente,
  datosBaseRecetas,
  listarCostosVariables,
  actualizarCostoVariable,
  prepararReceta,
  historialPreparaciones,
  realizarReceta,
  cancelarReceta,
} from "../controllers/recetas.controller.js";

import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";

const router = express.Router();

const soloAdmin = [verificarToken, verificarRol("ADMIN")];

function validarIdParam(nombre) {
  return (req, res, next) => {
    if (isNaN(Number(req.params[nombre]))) {
      return res.status(400).json({ ok: false, message: "ID invalido" });
    }

    next();
  };
}

router.get("/datos-base", ...soloAdmin, datosBaseRecetas);
router.get("/costos-variables", ...soloAdmin, listarCostosVariables);
router.put(
  "/costos-variables/:id",
  ...soloAdmin,
  validarIdParam("id"),
  actualizarCostoVariable,
);

router.get("/historial", ...soloAdmin, historialPreparaciones);
router.get("/preparaciones/historial", ...soloAdmin, historialPreparaciones);

router.get("/", ...soloAdmin, listarRecetas);
router.post("/", ...soloAdmin, crearReceta);

router.post(
  "/historial/:historialId/cancelar",
  ...soloAdmin,
  validarIdParam("historialId"),
  cancelarReceta,
);

router.get(
  "/:recetaId",
  ...soloAdmin,
  validarIdParam("recetaId"),
  detalleReceta,
);
router.put(
  "/:recetaId",
  ...soloAdmin,
  validarIdParam("recetaId"),
  actualizarReceta,
);
router.delete(
  "/:recetaId",
  ...soloAdmin,
  validarIdParam("recetaId"),
  eliminarReceta,
);

router.post(
  "/:recetaId/ingredientes",
  ...soloAdmin,
  validarIdParam("recetaId"),
  agregarIngrediente,
);
router.put(
  "/:recetaId/ingredientes/:ingredienteId",
  ...soloAdmin,
  validarIdParam("recetaId"),
  validarIdParam("ingredienteId"),
  actualizarIngrediente,
);

router.post(
  "/:recetaId/preparar",
  ...soloAdmin,
  validarIdParam("recetaId"),
  prepararReceta,
);
router.post(
  "/:recetaId/realizar",
  ...soloAdmin,
  validarIdParam("recetaId"),
  realizarReceta,
);
router.post(
  "/:recetaId/cancelar",
  ...soloAdmin,
  validarIdParam("recetaId"),
  cancelarReceta,
);

export default router;
