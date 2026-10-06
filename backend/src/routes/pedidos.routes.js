import express from "express";

import {
  crearPedidoRapido,
  crearPedidoMesa,
  obtenerPedidosAbiertos,
  obtenerDetallePedido,
  agregarProductoPedido,
  eliminarDetallePedido,
  actualizarCantidadDetallePedido,
  actualizarPropina,
  cobrarPedido,
} from "../controllers/pedidos.controller.js";

import {
  verificarToken,
  verificarRol,
} from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get(
  "/abiertos",
  verificarToken,
  verificarRol("ADMIN", "EMPLEADO"),
  obtenerPedidosAbiertos
);

router.get(
  "/:id",
  verificarToken,
  verificarRol("ADMIN", "EMPLEADO"),
  obtenerDetallePedido
);

router.post(
  "/rapido",
  verificarToken,
  verificarRol("ADMIN", "EMPLEADO"),
  crearPedidoRapido
);

router.post(
  "/mesa",
  verificarToken,
  verificarRol("ADMIN", "EMPLEADO"),
  crearPedidoMesa
);

router.post(
  "/detalle",
  verificarToken,
  verificarRol("ADMIN", "EMPLEADO"),
  agregarProductoPedido
);

router.delete(
  "/detalle/:id",
  verificarToken,
  verificarRol("ADMIN", "EMPLEADO"),
  eliminarDetallePedido
);

router.patch(
  "/detalle/:id",
  verificarToken,
  verificarRol("ADMIN", "EMPLEADO"),
  actualizarCantidadDetallePedido
);

router.patch(
  "/:id/propina",
  verificarToken,
  verificarRol("ADMIN", "EMPLEADO"),
  actualizarPropina
);

router.post(
  "/cobrar",
  verificarToken,
  verificarRol("ADMIN", "EMPLEADO"),
  cobrarPedido
);

export default router;
