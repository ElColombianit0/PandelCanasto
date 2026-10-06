import { Router } from "express";

import {
  obtenerConfiguracionSitio,
  guardarConfiguracionSitio,
  obtenerBanners,
  crearBanner,
  actualizarBanner,
  eliminarBanner,
} from "../controllers/configuracionSitio.controller.js";

import { verificarToken } from "../middlewares/auth.middleware.js";
import { uploadBanner } from "../middlewares/upload.middleware.js";

const router = Router();

/* CONFIG */

router.get("/", obtenerConfiguracionSitio);

router.put(
  "/",
  verificarToken,
  guardarConfiguracionSitio
);

/* BANNERS */

router.get("/banners", obtenerBanners);

router.post(
  "/banners",
  verificarToken,
  uploadBanner.single("imagen"),
  crearBanner
);

router.put(
  "/banners/:id",
  verificarToken,
  uploadBanner.single("imagen"),
  actualizarBanner
);

router.delete(
  "/banners/:id",
  verificarToken,
  eliminarBanner
);

export default router;
