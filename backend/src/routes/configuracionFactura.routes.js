import express from "express";
import multer from "multer";
import path from "path";

import {
  obtenerConfiguracionFactura,
  actualizarConfiguracionFactura,
} from "../controllers/configuracionFactura.controller.js";

import {
  verificarToken,
  verificarRol,
} from "../middlewares/auth.middleware.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/factura",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nombre = `logo-factura-${Date.now()}${ext}`;
    cb(null, nombre);
  },
});

const upload = multer({ storage });

router.get(
  "/",
  verificarToken,
  verificarRol("ADMIN", "EMPLEADO"),
  obtenerConfiguracionFactura
);

router.put(
  "/",
  verificarToken,
  verificarRol("ADMIN"),
  upload.single("logo"),
  actualizarConfiguracionFactura
);

export default router;
