import jwt from "jsonwebtoken";

export function generarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "12h",
    }
  );
}
