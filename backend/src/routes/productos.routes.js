import express from "express";
import multer from "multer";
import path from "path";

import {
  obtenerProductos,
  obtenerProductosMenu,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
} from "../controllers/productos.controller.js";

import {
  verificarToken,
  verificarRol,
} from "../middlewares/auth.middleware.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/productos",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nombre = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, nombre);
  },
});

const upload = multer({ storage });

router.get("/menu", obtenerProductosMenu);

router.get(
  "/",
  verificarToken,
  verificarRol("ADMIN", "EMPLEADO"),
  obtenerProductos
);

router.post(
  "/",
  verificarToken,
  verificarRol("ADMIN"),
  upload.single("imagen"),
  crearProducto
);

router.put(
  "/:id",
  verificarToken,
  verificarRol("ADMIN"),
  upload.single("imagen"),
  actualizarProducto
);

router.delete(
  "/:id",
  verificarToken,
  verificarRol("ADMIN"),
  eliminarProducto
);

export default router;
