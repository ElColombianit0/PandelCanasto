import { pool } from "../config/db.js";
import { recalcularReceta } from "./recetas.controller.js";
import { asegurarTablasOperaciones } from "../utils/operacionesSchema.js";

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function periodoMes(mes) {
  const value = /^\d{4}-\d{2}$/.test(String(mes || ""))
    ? `${mes}-01`
    : null;

  return value;
}

export async function listarCostosVariablesAdmin(req, res) {
  try {
    const result = await pool.query(`
      SELECT *
      FROM costos_variables
      WHERE activo = true
      ORDER BY
        CASE tipo
          WHEN 'MANO_OBRA' THEN 1
          WHEN 'GAS' THEN 2
          WHEN 'LUZ' THEN 3
          ELSE 4
        END,
        nombre ASC
    `);

    res.json({ ok: true, costos: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error listando costos" });
  }
}

export async function actualizarCostoVariableAdmin(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const { valor, unidad } = req.body;

    const result = await client.query(
      `
      UPDATE costos_variables
      SET
        valor = $1,
        unidad = COALESCE($2, unidad),
        actualizado_en = timezone('America/Bogota', now())
      WHERE id = $3
      AND activo = true
      RETURNING *
      `,
      [toNumber(valor, 0), unidad || null, id],
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, message: "Costo no encontrado" });
    }

    const recetas = await client.query(`
      SELECT id
      FROM recetas
      WHERE activo = true
    `);

    for (const receta of recetas.rows) {
      await recalcularReceta(
        client,
        receta.id,
        req.usuario.id,
        `Costo variable actualizado: ${result.rows[0].nombre}`,
      );
    }

    await client.query("COMMIT");

    res.json({
      ok: true,
      costo: result.rows[0],
      recetas_recalculadas: recetas.rows.length,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ ok: false, message: "Error actualizando costo" });
  } finally {
    client.release();
  }
}

export async function listarSucursales(req, res) {
  try {
    const result = await pool.query(`
      SELECT *
      FROM sucursales
      WHERE activo = true
      ORDER BY nombre ASC
    `);

    res.json({ ok: true, sucursales: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error listando sucursales" });
  }
}

export async function crearSucursal(req, res) {
  try {
    const { nombre, direccion, telefono } = req.body;

    if (!nombre) {
      return res.status(400).json({ ok: false, message: "El nombre es obligatorio" });
    }

    const result = await pool.query(
      `
      INSERT INTO sucursales (nombre, direccion, telefono, activo)
      VALUES ($1,$2,$3,true)
      RETURNING *
      `,
      [nombre, direccion || null, telefono || null],
    );

    res.status(201).json({ ok: true, sucursal: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error creando sucursal" });
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
      AND activo = true
      RETURNING *
      `,
      [nombre, direccion || null, telefono || null, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Sucursal no encontrada" });
    }

    res.json({ ok: true, sucursal: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error actualizando sucursal" });
  }
}

export async function eliminarSucursal(req, res) {
  try {
    const { id } = req.params;

    await pool.query(`UPDATE sucursales SET activo = false WHERE id = $1`, [id]);

    res.json({ ok: true, message: "Sucursal desactivada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error desactivando sucursal" });
  }
}

export async function listarGastos(req, res) {
  try {
    const periodo = periodoMes(req.query.mes);
    const valores = [];
    const filtros = ["go.activo = true"];

    if (periodo) {
      valores.push(periodo);
      filtros.push(`(
        go.periodo_mes = $${valores.length}::date
        OR (go.recurrente = true AND go.periodo_mes <= $${valores.length}::date)
      )`);
    }

    const result = await pool.query(
      `
      SELECT
        go.*,
        s.nombre AS sucursal_nombre,
        u.nombre AS usuario_nombre
      FROM gastos_operativos go
      LEFT JOIN sucursales s ON s.id = go.sucursal_id
      LEFT JOIN usuarios u ON u.id = go.usuario_id
      WHERE ${filtros.join(" AND ")}
      ORDER BY go.fecha DESC, go.id DESC
      `,
      valores,
    );

    res.json({ ok: true, gastos: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error listando gastos" });
  }
}

export async function guardarGasto(req, res) {
  try {
    const {
      concepto,
      monto,
      descripcion,
      tipo = "VARIABLE",
      categoria,
      fecha,
      mes,
      cantidad,
      valor_unitario,
      sucursal_id,
      recurrente,
    } = req.body;

    if (!concepto) {
      return res.status(400).json({ ok: false, message: "El concepto es obligatorio" });
    }

    const cantidadFinal = toNumber(cantidad, 1) || 1;
    const valorUnitarioFinal = toNumber(valor_unitario, toNumber(monto, 0));
    const montoFinal = toNumber(monto, cantidadFinal * valorUnitarioFinal);
    const periodo = periodoMes(mes) || periodoMes(String(fecha || "").slice(0, 7));

    const result = await pool.query(
      `
      INSERT INTO gastos_operativos (
        usuario_id,
        concepto,
        monto,
        descripcion,
        tipo,
        categoria,
        fecha,
        periodo_mes,
        cantidad,
        valor_unitario,
        recurrente,
        sucursal_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::date, (timezone('America/Bogota', now()))::date),COALESCE($8::date, date_trunc('month', COALESCE($7::date, (timezone('America/Bogota', now()))::date)::timestamp)::date),$9,$10,$11,$12)
      RETURNING *
      `,
      [
        req.usuario.id,
        concepto,
        montoFinal,
        descripcion || null,
        tipo,
        categoria || null,
        fecha || null,
        periodo,
        cantidadFinal,
        valorUnitarioFinal,
        recurrente === true || recurrente === "true",
        sucursal_id || null,
      ],
    );

    res.status(201).json({ ok: true, gasto: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error guardando gasto" });
  }
}

export async function actualizarGasto(req, res) {
  try {
    const { id } = req.params;
    const {
      concepto,
      monto,
      descripcion,
      tipo = "VARIABLE",
      categoria,
      fecha,
      mes,
      cantidad,
      valor_unitario,
      sucursal_id,
      recurrente,
    } = req.body;

    const cantidadFinal = toNumber(cantidad, 1) || 1;
    const valorUnitarioFinal = toNumber(valor_unitario, toNumber(monto, 0));
    const montoFinal = toNumber(monto, cantidadFinal * valorUnitarioFinal);
    const periodo = periodoMes(mes) || periodoMes(String(fecha || "").slice(0, 7));

    const result = await pool.query(
      `
      UPDATE gastos_operativos
      SET
        concepto = $1,
        monto = $2,
        descripcion = $3,
        tipo = $4,
        categoria = $5,
        fecha = COALESCE($6::date, fecha),
        periodo_mes = COALESCE($7::date, date_trunc('month', COALESCE($6::date, fecha)::timestamp)::date),
        cantidad = $8,
        valor_unitario = $9,
        recurrente = $10,
        sucursal_id = $11
      WHERE id = $12
      AND activo = true
      RETURNING *
      `,
      [
        concepto,
        montoFinal,
        descripcion || null,
        tipo,
        categoria || null,
        fecha || null,
        periodo,
        cantidadFinal,
        valorUnitarioFinal,
        recurrente === true || recurrente === "true",
        sucursal_id || null,
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Gasto no encontrado" });
    }

    res.json({ ok: true, gasto: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error actualizando gasto" });
  }
}

export async function eliminarGasto(req, res) {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE gastos_operativos SET activo = false WHERE id = $1`, [id]);
    res.json({ ok: true, message: "Gasto eliminado" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error eliminando gasto" });
  }
}

export async function listarHorasExtra(req, res) {
  try {
    const periodo = periodoMes(req.query.mes);
    const valores = [];
    const filtros = ["1=1"];

    if (periodo) {
      valores.push(periodo);
      filtros.push(`he.fecha >= $${valores.length}::date`);
      valores.push(periodo);
      filtros.push(`he.fecha < $${valores.length}::date + interval '1 month'`);
    }

    const result = await pool.query(
      `
      SELECT
        he.*,
        u.nombre AS empleado_nombre,
        s.nombre AS sucursal_nombre
      FROM horas_extra_empleados he
      INNER JOIN usuarios u ON u.id = he.usuario_id
      LEFT JOIN sucursales s ON s.id = he.sucursal_id
      WHERE ${filtros.join(" AND ")}
      ORDER BY he.fecha DESC, he.id DESC
      `,
      valores,
    );

    res.json({ ok: true, horas: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error listando horas extra" });
  }
}

export async function guardarHoraExtra(req, res) {
  try {
    const {
      usuario_id,
      sucursal_id,
      tipo = "EXTRA_DIURNA",
      fecha,
      hora_inicio,
      horas,
      valor_hora,
      observacion,
    } = req.body;

    const horasFinal = toNumber(horas, 0);
    const valorHoraFinal = toNumber(valor_hora, 0);
    const multiplicadorFinal = 1;
    const total = horasFinal * valorHoraFinal * multiplicadorFinal;

    if (!usuario_id || horasFinal <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Empleado y horas son obligatorios",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO horas_extra_empleados (
        usuario_id,
        sucursal_id,
        tipo,
        fecha,
        hora_inicio,
        horas,
        valor_hora,
        multiplicador,
        total,
        observacion
      )
      VALUES ($1,$2,$3,COALESCE($4::date, (timezone('America/Bogota', now()))::date),$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        usuario_id,
        sucursal_id || null,
        tipo,
        fecha || null,
        hora_inicio || null,
        horasFinal,
        valorHoraFinal,
        multiplicadorFinal,
        total,
        observacion || null,
      ],
    );

    res.status(201).json({ ok: true, hora: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error guardando hora extra" });
  }
}

export async function actualizarHoraExtra(req, res) {
  try {
    const { id } = req.params;
    const {
      usuario_id,
      sucursal_id,
      tipo = "EXTRA_DIURNA",
      fecha,
      hora_inicio,
      horas,
      valor_hora,
      observacion,
    } = req.body;

    const horasFinal = toNumber(horas, 0);
    const valorHoraFinal = toNumber(valor_hora, 0);
    const total = horasFinal * valorHoraFinal;

    if (!usuario_id || horasFinal <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Empleado y horas son obligatorios",
      });
    }

    const result = await pool.query(
      `
      UPDATE horas_extra_empleados
      SET
        usuario_id = $1,
        sucursal_id = $2,
        tipo = $3,
        fecha = COALESCE($4::date, fecha),
        hora_inicio = $5,
        horas = $6,
        valor_hora = $7,
        multiplicador = 1,
        total = $8,
        observacion = $9
      WHERE id = $10
      RETURNING *
      `,
      [
        usuario_id,
        sucursal_id || null,
        tipo,
        fecha || null,
        hora_inicio || null,
        horasFinal,
        valorHoraFinal,
        total,
        observacion || null,
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Registro no encontrado" });
    }

    res.json({ ok: true, hora: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error actualizando hora extra" });
  }
}

export async function eliminarHoraExtra(req, res) {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM horas_extra_empleados WHERE id = $1`, [id]);
    res.json({ ok: true, message: "Registro eliminado" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error eliminando hora extra" });
  }
}

export async function resumenUtilidad(req, res) {
  try {
    await asegurarTablasOperaciones();

    const periodo = periodoMes(req.query.mes) || periodoMes(new Date().toISOString().slice(0, 7));

    const [ventas, gastos, gastosCaja, comisionDatafono, horas, empleados] = await Promise.all([
      pool.query(
        `
        SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS cantidad
        FROM ventas
        WHERE COALESCE(estado, 'VALIDA') != 'ANULADA'
        AND fecha_venta >= $1::date
        AND fecha_venta < $1::date + interval '1 month'
        `,
        [periodo],
      ),
      pool.query(
        `
        SELECT
          COALESCE(SUM(monto), 0) AS total,
          COALESCE(SUM(monto) FILTER (WHERE tipo = 'EMPLEADOS'), 0) AS empleados,
          COALESCE(SUM(monto) FILTER (WHERE tipo = 'FIJO'), 0) AS fijos,
          COALESCE(SUM(monto) FILTER (WHERE tipo = 'VARIABLE'), 0) AS variables,
          COALESCE(SUM(monto) FILTER (WHERE tipo = 'COMPRA'), 0) AS compras
        FROM gastos_operativos
        WHERE activo = true
        AND (
          periodo_mes = $1::date
          OR (recurrente = true AND periodo_mes <= $1::date)
        )
        `,
        [periodo],
      ),
      pool.query(
        `
        SELECT COALESCE(SUM(monto), 0) AS total
        FROM caja_gastos
        WHERE fecha >= $1::date
        AND fecha < $1::date + interval '1 month'
        `,
        [periodo],
      ),
      pool.query(
        `
        SELECT COALESCE(SUM(v.total), 0) * 0.0489 AS total
        FROM ventas v
        INNER JOIN pagos p ON p.id = v.pago_id
        INNER JOIN metodos_pago mp ON mp.id = p.metodo_pago_id
        WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
        AND LOWER(mp.nombre) LIKE '%tarjeta%'
        AND v.fecha_venta >= $1::date
        AND v.fecha_venta < $1::date + interval '1 month'
        `,
        [periodo],
      ),
      pool.query(
        `
        SELECT COALESCE(SUM(total), 0) AS total
        FROM horas_extra_empleados
        WHERE fecha >= $1::date
        AND fecha < $1::date + interval '1 month'
        `,
        [periodo],
      ),
      pool.query(`
        SELECT COUNT(*) AS total
        FROM usuarios
        WHERE rol = 'EMPLEADO'
        AND activo = true
      `),
    ]);

    const totalVentas = Number(ventas.rows[0].total || 0);
    const totalGastosOperativos = Number(gastos.rows[0].total || 0);
    const totalGastosCaja = Number(gastosCaja.rows[0].total || 0);
    const totalComisionDatafono = Number(comisionDatafono.rows[0].total || 0);
    const totalGastos = totalGastosOperativos + totalGastosCaja + totalComisionDatafono;
    const totalHorasExtra = Number(horas.rows[0].total || 0);
    const utilidadNeta = totalVentas - totalGastos - totalHorasExtra;

    res.json({
      ok: true,
      periodo,
      resumen: {
        ventas: totalVentas,
        cantidad_ventas: Number(ventas.rows[0].cantidad || 0),
        gastos: totalGastos,
        gastos_operativos: totalGastosOperativos,
        gastos_caja: totalGastosCaja,
        comision_datafono: totalComisionDatafono,
        gastos_empleados: Number(gastos.rows[0].empleados || 0),
        gastos_fijos: Number(gastos.rows[0].fijos || 0),
        gastos_variables: Number(gastos.rows[0].variables || 0),
        compras: Number(gastos.rows[0].compras || 0),
        horas_extra: totalHorasExtra,
        utilidad_neta: utilidadNeta,
        empleados_activos: Number(empleados.rows[0].total || 0),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error calculando utilidad" });
  }
}
