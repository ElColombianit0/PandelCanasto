export function soloAdmin(req, res, next) {
  if (req.usuario?.rol !== "ADMIN") {
    return res.status(403).json({
      ok: false,
      message: "Acceso permitido solo para administradores",
    });
  }

  next();
}

export function adminOEmpleado(req, res, next) {
  if (!["ADMIN", "EMPLEADO"].includes(req.usuario?.rol)) {
    return res.status(403).json({
      ok: false,
      message: "Acceso denegado",
    });
  }

  next();
}
