import express from "express";
import multer from "multer";
import path from "path";

import {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from "../controllers/categorias.controller.js";

import {
  verificarToken,
  verificarRol,
} from "../middlewares/auth.middleware.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/categorias",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nombre = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, nombre);
  },
});

const upload = multer({ storage });

router.get("/", listarCategorias);

router.post(
  "/",
  verificarToken,
  verificarRol("ADMIN"),
  upload.single("imagen"),
  crearCategoria
);

router.put(
  "/:id",
  verificarToken,
  verificarRol("ADMIN"),
  upload.single("imagen"),
  actualizarCategoria
);

router.delete(
  "/:id",
  verificarToken,
  verificarRol("ADMIN"),
  eliminarCategoria
);

export default router;
