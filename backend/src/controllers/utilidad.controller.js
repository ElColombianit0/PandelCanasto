import { pool } from "../config/db.js";

async function asegurarTablasUtilidad() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS utilidad_gastos_fijos (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(160) NOT NULL,
      categoria VARCHAR(60) DEFAULT 'FIJO',
      valor_unitario NUMERIC(14,2) DEFAULT 0,
      cantidad NUMERIC(14,2) DEFAULT 1,
      activo BOOLEAN DEFAULT true,
      creado_en TIMESTAMP DEFAULT timezone('America/Bogota', now()),
      actualizado_en TIMESTAMP DEFAULT timezone('America/Bogota', now())
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS utilidad_gastos_variables (
      id SERIAL PRIMARY KEY,
      descripcion VARCHAR(180) NOT NULL,
      tipo VARCHAR(60) DEFAULT 'GASTO',
      valor NUMERIC(14,2) DEFAULT 0,
      fecha DATE DEFAULT (timezone('America/Bogota', now()))::date,
      usuario_id INTEGER,
      creado_en TIMESTAMP DEFAULT timezone('America/Bogota', now())
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS utilidad_horas_extra (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      tipo VARCHAR(60) DEFAULT 'EXTRA',
      fecha DATE DEFAULT (timezone('America/Bogota', now()))::date,
      cantidad_horas NUMERIC(10,2) DEFAULT 0,
      valor_hora NUMERIC(14,2) DEFAULT 0,
      observacion TEXT,
      creado_en TIMESTAMP DEFAULT timezone('America/Bogota', now())
    )
  `);
}

function rangoMes(mes) {
  const limpio = /^\d{4}-\d{2}$/.test(mes || "") ? mes : null;
  const inicio = limpio ? `${limpio}-01` : null;
  return inicio;
}

export async function resumenUtilidad(req, res) {
  try {
    await asegurarTablasUtilidad();

    const inicioMes = rangoMes(req.query.mes);

    const ventas = await pool.query(
      `
      SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS cantidad
      FROM ventas
      WHERE COALESCE(estado, 'VALIDA') != 'ANULADA'
      AND fecha_venta >= COALESCE($1::date, date_trunc('month', timezone('America/Bogota', now()))::date)
      AND fecha_venta < COALESCE($1::date, date_trunc('month', timezone('America/Bogota', now()))::date) + interval '1 month'
      `,
      [inicioMes],
    );

    const gastosFijos = await pool.query(`
      SELECT COALESCE(SUM(valor_unitario * cantidad), 0) AS total
      FROM utilidad_gastos_fijos
      WHERE activo = true
    `);

    const gastosVariables = await pool.query(
      `
      SELECT COALESCE(SUM(valor), 0) AS total
      FROM utilidad_gastos_variables
      WHERE fecha >= COALESCE($1::date, date_trunc('month', timezone('America/Bogota', now()))::date)
      AND fecha < COALESCE($1::date, date_trunc('month', timezone('America/Bogota', now()))::date) + interval '1 month'
      `,
      [inicioMes],
    );

    const horasExtra = await pool.query(
      `
      SELECT COALESCE(SUM(cantidad_horas * valor_hora), 0) AS total
      FROM utilidad_horas_extra
      WHERE fecha >= COALESCE($1::date, date_trunc('month', timezone('America/Bogota', now()))::date)
      AND fecha < COALESCE($1::date, date_trunc('month', timezone('America/Bogota', now()))::date) + interval '1 month'
      `,
      [inicioMes],
    );

    const totalVentas = Number(ventas.rows[0].total || 0);
    const totalFijos = Number(gastosFijos.rows[0].total || 0);
    const totalVariables = Number(gastosVariables.rows[0].total || 0);
    const totalHorasExtra = Number(horasExtra.rows[0].total || 0);
    const totalGastos = totalFijos + totalVariables + totalHorasExtra;

    res.json({
      ok: true,
      resumen: {
        ventas: totalVentas,
        cantidad_ventas: Number(ventas.rows[0].cantidad || 0),
        gastos_fijos: totalFijos,
        gastos_variables: totalVariables,
        horas_extra: totalHorasExtra,
        gastos_totales: totalGastos,
        utilidad_neta: totalVentas - totalGastos,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error calculando utilidad",
    });
  }
}

export async function datosBaseUtilidad(req, res) {
  try {
    await asegurarTablasUtilidad();

    const empleados = await pool.query(`
      SELECT id, nombre, documento
      FROM usuarios
      WHERE rol = 'EMPLEADO'
      ORDER BY nombre ASC
    `);

    res.json({
      ok: true,
      empleados: empleados.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error cargando datos base",
    });
  }
}

export async function listarGastosFijos(req, res) {
  try {
    await asegurarTablasUtilidad();
    const result = await pool.query(`
      SELECT *, valor_unitario * cantidad AS total
      FROM utilidad_gastos_fijos
      WHERE activo = true
      ORDER BY id DESC
    `);

    res.json({ ok: true, gastos: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error listando gastos fijos" });
  }
}

export async function guardarGastoFijo(req, res) {
  try {
    await asegurarTablasUtilidad();
    const { id } = req.params;
    const { nombre, categoria, valor_unitario, cantidad } = req.body;

    if (id) {
      const result = await pool.query(
        `
        UPDATE utilidad_gastos_fijos
        SET nombre = $1,
            categoria = $2,
            valor_unitario = $3,
            cantidad = $4,
            actualizado_en = timezone('America/Bogota', now())
        WHERE id = $5
        RETURNING *
        `,
        [nombre, categoria || "FIJO", valor_unitario || 0, cantidad || 1, id],
      );

      return res.json({ ok: true, gasto: result.rows[0] });
    }

    const result = await pool.query(
      `
      INSERT INTO utilidad_gastos_fijos (nombre, categoria, valor_unitario, cantidad)
      VALUES ($1,$2,$3,$4)
      RETURNING *
      `,
      [nombre, categoria || "FIJO", valor_unitario || 0, cantidad || 1],
    );

    res.status(201).json({ ok: true, gasto: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error guardando gasto fijo" });
  }
}

export async function eliminarGastoFijo(req, res) {
  try {
    await asegurarTablasUtilidad();
    await pool.query(
      `
      UPDATE utilidad_gastos_fijos
      SET activo = false
      WHERE id = $1
      `,
      [req.params.id],
    );

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error eliminando gasto fijo" });
  }
}

export async function listarGastosVariables(req, res) {
  try {
    await asegurarTablasUtilidad();
    const inicioMes = rangoMes(req.query.mes);
    const result = await pool.query(
      `
      SELECT *
      FROM utilidad_gastos_variables
      WHERE fecha >= COALESCE($1::date, date_trunc('month', timezone('America/Bogota', now()))::date)
      AND fecha < COALESCE($1::date, date_trunc('month', timezone('America/Bogota', now()))::date) + interval '1 month'
      ORDER BY fecha DESC, id DESC
      `,
      [inicioMes],
    );

    res.json({ ok: true, gastos: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error listando gastos" });
  }
}

export async function guardarGastoVariable(req, res) {
  try {
    await asegurarTablasUtilidad();
    const { id } = req.params;
    const { descripcion, tipo, valor, fecha } = req.body;

    if (id) {
      const result = await pool.query(
        `
        UPDATE utilidad_gastos_variables
        SET descripcion = $1,
            tipo = $2,
            valor = $3,
            fecha = $4
        WHERE id = $5
        RETURNING *
        `,
        [descripcion, tipo || "GASTO", valor || 0, fecha, id],
      );

      return res.json({ ok: true, gasto: result.rows[0] });
    }

    const result = await pool.query(
      `
      INSERT INTO utilidad_gastos_variables (descripcion, tipo, valor, fecha, usuario_id)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [descripcion, tipo || "GASTO", valor || 0, fecha, req.usuario.id],
    );

    res.status(201).json({ ok: true, gasto: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error guardando gasto" });
  }
}

export async function eliminarGastoVariable(req, res) {
  try {
    await asegurarTablasUtilidad();
    await pool.query(`DELETE FROM utilidad_gastos_variables WHERE id = $1`, [
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error eliminando gasto" });
  }
}

export async function listarHorasExtra(req, res) {
  try {
    await asegurarTablasUtilidad();
    const inicioMes = rangoMes(req.query.mes);
    const result = await pool.query(
      `
      SELECT
        he.*,
        u.nombre AS empleado_nombre,
        he.cantidad_horas * he.valor_hora AS total
      FROM utilidad_horas_extra he
      INNER JOIN usuarios u ON u.id = he.usuario_id
      WHERE he.fecha >= COALESCE($1::date, date_trunc('month', timezone('America/Bogota', now()))::date)
      AND he.fecha < COALESCE($1::date, date_trunc('month', timezone('America/Bogota', now()))::date) + interval '1 month'
      ORDER BY he.fecha DESC, he.id DESC
      `,
      [inicioMes],
    );

    res.json({ ok: true, horas: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error listando horas extra" });
  }
}

export async function guardarHoraExtra(req, res) {
  try {
    await asegurarTablasUtilidad();
    const { id } = req.params;
    const {
      usuario_id,
      tipo,
      fecha,
      cantidad_horas,
      valor_hora,
      observacion,
    } = req.body;

    if (id) {
      const result = await pool.query(
        `
        UPDATE utilidad_horas_extra
        SET usuario_id = $1,
            tipo = $2,
            fecha = $3,
            cantidad_horas = $4,
            valor_hora = $5,
            observacion = $6
        WHERE id = $7
        RETURNING *
        `,
        [
          usuario_id,
          tipo || "EXTRA",
          fecha,
          cantidad_horas || 0,
          valor_hora || 0,
          observacion || null,
          id,
        ],
      );

      return res.json({ ok: true, hora: result.rows[0] });
    }

    const result = await pool.query(
      `
      INSERT INTO utilidad_horas_extra (
        usuario_id,
        tipo,
        fecha,
        cantidad_horas,
        valor_hora,
        observacion
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        usuario_id,
        tipo || "EXTRA",
        fecha,
        cantidad_horas || 0,
        valor_hora || 0,
        observacion || null,
      ],
    );

    res.status(201).json({ ok: true, hora: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error guardando hora extra" });
  }
}

export async function eliminarHoraExtra(req, res) {
  try {
    await asegurarTablasUtilidad();
    await pool.query(`DELETE FROM utilidad_horas_extra WHERE id = $1`, [
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error eliminando hora extra" });
  }
}

