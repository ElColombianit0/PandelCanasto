import jwt from "jsonwebtoken";

export function verificarToken(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        ok: false,
        message: "Token requerido",
      });
    }

    const token = authorization.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: "Formato de token inválido",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = decoded;

    next();
  } catch {
    return res.status(401).json({
      ok: false,
      message: "Token inválido o expirado",
    });
  }
}
