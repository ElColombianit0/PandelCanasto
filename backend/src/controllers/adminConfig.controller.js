import { pool } from "../config/db.js";

const costosBase = [
  {
    nombre: "mano_obra_hora",
    tipo: "MANO_OBRA",
    unidad: "hora",
    etiqueta: "Mano de obra por hora",
  },
  {
    nombre: "kwh_luz",
    tipo: "LUZ",
    unidad: "kWh",
    etiqueta: "Luz por kWh",
  },
  {
    nombre: "gas",
    tipo: "GAS",
    unidad: "unidad",
    etiqueta: "Gas",
  },
];

async function asegurarCostosBase() {
  for (const costo of costosBase) {
    await pool.query(
      `
      INSERT INTO costos_variables (nombre, tipo, valor, unidad, activo)
      VALUES ($1,$2,$3,$4,true)
      ON CONFLICT (tipo)
      DO UPDATE SET
        nombre = EXCLUDED.nombre,
        unidad = EXCLUDED.unidad,
        activo = true,
        actualizado_en = timezone('America/Bogota', now())
      `,
      [costo.nombre, costo.tipo, 0, costo.unidad],
    );
  }
}

export async function obtenerConfiguracionAdmin(req, res) {
  try {
    await asegurarCostosBase();

    const [costos, sucursales] = await Promise.all([
      pool.query(`
        SELECT *
        FROM costos_variables
        WHERE nombre IN ('mano_obra_hora', 'kwh_luz', 'gas')
        ORDER BY nombre ASC
      `),
      pool.query(`
        SELECT *
        FROM sucursales
        ORDER BY nombre ASC
      `),
    ]);

    const costosConEtiqueta = costos.rows.map((costo) => ({
      ...costo,
      etiqueta:
        costosBase.find((base) => base.nombre === costo.nombre)?.etiqueta ||
        costo.nombre,
    }));

    res.json({
      ok: true,
      costos: costosConEtiqueta,
      sucursales: sucursales.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error cargando configuracion",
    });
  }
}

export async function actualizarCostoVariableAdmin(req, res) {
  try {
    await asegurarCostosBase();

    const { id } = req.params;
    const { valor } = req.body;

    const result = await pool.query(
      `
      UPDATE costos_variables
      SET
        valor = $1,
        actualizado_en = timezone('America/Bogota', now())
      WHERE id = $2
      RETURNING *
      `,
      [Number(valor || 0), id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Costo no encontrado",
      });
    }

    res.json({
      ok: true,
      costo: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error actualizando costo",
    });
  }
}

export async function crearSucursal(req, res) {
  try {
    const { nombre, direccion, telefono } = req.body;

    if (!nombre?.trim()) {
      return res.status(400).json({
        ok: false,
        message: "El nombre de la sucursal es obligatorio",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO sucursales (nombre, direccion, telefono)
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [nombre.trim(), direccion || null, telefono || null],
    );

    res.status(201).json({
      ok: true,
      sucursal: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error creando sucursal",
    });
  }
}

export async function actualizarSucursal(req, res) {
  try {
    const { id } = req.params;
    const { nombre, direccion, telefono } = req.body;

    const result = await pool.query(
      `
      UPDATE sucursales
      SET nombre = $1,
          direccion = $2,
          telefono = $3
      WHERE id = $4
      RETURNING *
      `,
      [nombre, direccion || null, telefono || null, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Sucursal no encontrada",
      });
    }

    res.json({
      ok: true,
      sucursal: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error actualizando sucursal",
    });
  }
}
