import { pool } from "../config/db.js";

export async function obtenerMesas(req, res) {
  try {
    const result = await pool.query(`
      SELECT *
      FROM mesas
      WHERE activo = true
      ORDER BY id ASC
    `);

    res.json({
      ok: true,
      mesas: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error obteniendo mesas",
    });
  }
}

export async function crearMesa(req, res) {
  try {
    const { nombre, capacidad } = req.body;

    if (!nombre) {
      return res.status(400).json({
        ok: false,
        message: "El nombre de la mesa es obligatorio",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO mesas (
        nombre,
        capacidad,
        estado,
        activo
      )
      VALUES ($1,$2,'LIBRE',true)
      RETURNING *
      `,
      [nombre, capacidad || null]
    );

    res.status(201).json({
      ok: true,
      mesa: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error creando mesa",
    });
  }
}

export async function actualizarMesa(req, res) {
  try {
    const { id } = req.params;
    const { nombre, capacidad, estado } = req.body;

    const mesaActual = await pool.query(
      `
      SELECT *
      FROM mesas
      WHERE id = $1
      AND activo = true
      `,
      [id]
    );

    if (mesaActual.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Mesa no encontrada",
      });
    }

    const result = await pool.query(
      `
      UPDATE mesas
      SET
        nombre = $1,
        capacidad = $2,
        estado = $3
      WHERE id = $4
      RETURNING *
      `,
      [
        nombre,
        capacidad || null,
        estado || mesaActual.rows[0].estado,
        id,
      ]
    );

    res.json({
      ok: true,
      mesa: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error actualizando mesa",
    });
  }
}

export async function eliminarMesa(req, res) {
  try {
    const { id } = req.params;

    const pedidoAbierto = await pool.query(
      `
      SELECT id
      FROM pedidos
      WHERE mesa_id = $1
      AND estado = 'ABIERTO'
      LIMIT 1
      `,
      [id]
    );

    if (pedidoAbierto.rows.length > 0) {
      return res.status(400).json({
        ok: false,
        message: "No puedes eliminar una mesa con pedido abierto",
      });
    }

    const result = await pool.query(
      `
      UPDATE mesas
      SET
        activo = false,
        estado = 'INACTIVA'
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Mesa no encontrada",
      });
    }

    res.json({
      ok: true,
      message: "Mesa eliminada",
      mesa: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error eliminando mesa",
    });
  }
}
