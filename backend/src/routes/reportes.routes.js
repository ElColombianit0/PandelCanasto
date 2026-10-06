import express from "express";
import { resumenDashboard } from "../controllers/reportes.controller.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get(
  "/dashboard",
  verificarToken,
  verificarRol("ADMIN"),
  resumenDashboard
);

export default router;
