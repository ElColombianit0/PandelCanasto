import bcrypt from "bcrypt";
import { pool } from "../config/db.js";

export async function listarEmpleados(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.nombre,
        u.email,
        u.documento,
        u.rol,
        u.activo,
        u.creado_en,
        u.sucursal_id,
        s.nombre AS sucursal_nombre
      FROM usuarios u
      LEFT JOIN sucursales s ON s.id = u.sucursal_id
      WHERE u.rol = 'EMPLEADO'
      ORDER BY u.id DESC
    `);

    res.json({
      ok: true,
      empleados: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error listando empleados",
    });
  }
}

export async function crearEmpleado(req, res) {
  try {
    const { nombre, email, documento, password, sucursal_id } = req.body;

    if (!nombre || !documento || !password) {
      return res.status(400).json({
        ok: false,
        message: "Nombre, documento y contraseña son obligatorios",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO usuarios (
        nombre,
        email,
        documento,
        password_hash,
        rol,
        sucursal_id,
        activo
      )
      VALUES ($1,$2,$3,$4,'EMPLEADO',$5,true)
      RETURNING id, nombre, email, documento, rol, sucursal_id, activo
      `,
      [nombre, email || null, documento, passwordHash, sucursal_id || null]
    );

    res.status(201).json({
      ok: true,
      empleado: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      return res.status(400).json({
        ok: false,
        message: "Ya existe un usuario con ese documento o correo",
      });
    }

    res.status(500).json({
      ok: false,
      message: "Error creando empleado",
    });
  }
}

export async function actualizarEmpleado(req, res) {
  try {
    const { id } = req.params;
    const { nombre, email, documento, activo, password, sucursal_id } = req.body;

    let result;

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);

      result = await pool.query(
        `
        UPDATE usuarios
        SET
          nombre = $1,
          email = $2,
          documento = $3,
          activo = $4,
          password_hash = $5,
          sucursal_id = $6,
          actualizado_en = CURRENT_TIMESTAMP
        WHERE id = $7
        AND rol = 'EMPLEADO'
        RETURNING id, nombre, email, documento, rol, sucursal_id, activo
        `,
        [nombre, email || null, documento, activo, passwordHash, sucursal_id || null, id]
      );
    } else {
      result = await pool.query(
        `
        UPDATE usuarios
        SET
          nombre = $1,
          email = $2,
          documento = $3,
          activo = $4,
          sucursal_id = $5,
          actualizado_en = CURRENT_TIMESTAMP
        WHERE id = $6
        AND rol = 'EMPLEADO'
        RETURNING id, nombre, email, documento, rol, sucursal_id, activo
        `,
        [nombre, email || null, documento, activo, sucursal_id || null, id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Empleado no encontrado",
      });
    }

    res.json({
      ok: true,
      empleado: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error actualizando empleado",
    });
  }
}

export async function desactivarEmpleado(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE usuarios
      SET activo = false,
          actualizado_en = CURRENT_TIMESTAMP
      WHERE id = $1
      AND rol = 'EMPLEADO'
      RETURNING id, nombre, email, documento, rol, activo
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Empleado no encontrado",
      });
    }

    res.json({
      ok: true,
      message: "Empleado desactivado",
      empleado: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error desactivando empleado",
    });
  }
}
