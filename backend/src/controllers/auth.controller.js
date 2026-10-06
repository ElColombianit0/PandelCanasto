import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

export async function login(req, res) {
  try {
    const { identificador, email, password } = req.body;

    const loginValue = identificador || email;

    if (!loginValue || !password) {
      return res.status(400).json({
        message: "Documento/correo y contraseña son obligatorios",
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM usuarios
      WHERE activo = true
      AND (
        email = $1
        OR documento = $1
      )
      LIMIT 1
      `,
      [loginValue]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Credenciales inválidas",
      });
    }

    const usuario = result.rows[0];

    const passwordCorrecto = await bcrypt.compare(
      password,
      usuario.password_hash
    );

    if (!passwordCorrecto) {
      return res.status(401).json({
        message: "Credenciales inválidas",
      });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        documento: usuario.documento,
        rol: usuario.rol,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "12h",
      }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        documento: usuario.documento,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error iniciando sesión",
    });
  }
}
