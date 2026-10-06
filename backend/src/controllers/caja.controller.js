import { pool } from "../config/db.js";
import { asegurarEsquemaCaja } from "../utils/cajaSchema.js";

function fechaHoyBogota() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());
}

function fechaValida(fecha) {
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const date = new Date(`${fecha}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === fecha;
}

function idValido(id) {
  return /^\d+$/.test(String(id)) && Number.isSafeInteger(Number(id)) && Number(id) > 0;
}

function validarGasto(body) {
  const fecha = body.fecha ?? fechaHoyBogota();
  const descripcion = typeof body.descripcion === "string" ? body.descripcion.trim() : "";
  const monto = Number(body.monto);
  const metodo = body.metodo_salida ?? "EFECTIVO";
  const etiqueta = body.etiqueta_id === "" || body.etiqueta_id == null ? null : body.etiqueta_id;

  if (!fechaValida(fecha)) return "Debes ingresar una fecha valida";
  if (!descripcion || descripcion.length > 1000) return "Debes ingresar una descripcion de hasta 1000 caracteres";
  if (!["string", "number"].includes(typeof body.monto) || !Number.isFinite(monto) || monto < 0.01 || monto >= 1e12) {
    return "Debes ingresar un monto valido mayor que cero";
  }
  if (!["EFECTIVO", "TRANSFERENCIA"].includes(metodo)) return "Metodo de salida no valido";
  if (etiqueta !== null && !idValido(etiqueta)) return "Etiqueta no valida";
  if (body.comentario != null && (typeof body.comentario !== "string" || body.comentario.length > 2000)) {
    return "El comentario debe tener hasta 2000 caracteres";
  }
  if (body.reintegrado != null && typeof body.reintegrado !== "boolean") return "Estado de reintegro no valido";
  return null;
}

function responderError(res, error, mensaje) {
  console.error(error);
  if (error.code === "23503") {
    return res.status(400).json({ ok: false, message: "La etiqueta seleccionada ya no existe" });
  }
  return res.status(500).json({ ok: false, message: mensaje });
}

export async function obtenerCierreCaja(req, res) {
  try {
    await asegurarEsquemaCaja();

    const fecha = req.query.fecha || fechaHoyBogota();
    if (!fechaValida(fecha)) {
      return res.status(400).json({ ok: false, message: "Fecha no valida" });
    }

    const ventas = await pool.query(
      `
      SELECT
        vp.metodo_pago,
        COUNT(DISTINCT v.id) AS cantidad,
        COALESCE(SUM(vp.monto), 0) AS total
      FROM ventas v
      INNER JOIN ventas_pagos_desglose vp ON vp.venta_id = v.id
      WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
      AND v.fecha_venta::date = $1::date
      GROUP BY vp.metodo_pago
      ORDER BY vp.metodo_pago
      `,
      [fecha],
    );

    const gastos = await pool.query(
      `
      SELECT cg.*, cg.fecha::text AS fecha, u.nombre AS usuario_nombre, ce.nombre AS etiqueta_nombre
      FROM caja_gastos cg
      LEFT JOIN usuarios u ON u.id = cg.usuario_id
      LEFT JOIN caja_etiquetas ce ON ce.id = cg.etiqueta_id
      WHERE cg.fecha = $1::date
      ORDER BY cg.creado_en DESC
      `,
      [fecha],
    );

    const gastosResumen = await pool.query(
      `
      SELECT metodo_salida, COALESCE(SUM(monto), 0) AS total
      FROM caja_gastos
      WHERE fecha = $1::date
      GROUP BY metodo_salida
      `,
      [fecha],
    );

    const productosVendidos = await pool.query(
      `
      SELECT
        pr.id,
        pr.nombre,
        COALESCE(SUM(dp.cantidad), 0) AS cantidad,
        COALESCE(SUM(dp.subtotal), 0) AS total
      FROM ventas v
      INNER JOIN pedidos pe ON pe.id = v.pedido_id
      INNER JOIN detalle_pedidos dp ON dp.pedido_id = pe.id
      INNER JOIN productos pr ON pr.id = dp.producto_id
      WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
      AND v.fecha_venta::date = $1::date
      GROUP BY pr.id, pr.nombre
      ORDER BY cantidad DESC, pr.nombre ASC
      `,
      [fecha],
    );

    res.json({
      ok: true,
      fecha,
      ventas: ventas.rows,
      gastos: gastos.rows,
      gastos_resumen: gastosResumen.rows,
      productos_vendidos: productosVendidos.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error obteniendo cierre de caja" });
  }
}

export async function crearGastoCaja(req, res) {
  return guardarGasto(req, res, false, false);
}

export async function actualizarGastoCaja(req, res) {
  return guardarGasto(req, res, false, true);
}

export async function eliminarGastoCaja(req, res) {
  return borrarGasto(req, res, false);
}

export async function crearGastoGeneral(req, res) {
  return guardarGasto(req, res, true, false);
}

export async function actualizarGastoGeneral(req, res) {
  return guardarGasto(req, res, true, true);
}

export async function eliminarGastoGeneral(req, res) {
  return borrarGasto(req, res, true);
}

async function guardarGasto(req, res, general, actualizar) {
  const errorValidacion = validarGasto(req.body || {});
  if (errorValidacion || (actualizar && !idValido(req.params.id))) {
    return res.status(400).json({ ok: false, message: errorValidacion || "Gasto no valido" });
  }

  try {
    await asegurarEsquemaCaja();
    // Los nombres de tabla solo se eligen aqui, nunca desde datos del cliente.
    const tabla = general ? "caja_general_gastos" : "caja_gastos";
    const body = req.body;
    const valores = [
      body.fecha ?? fechaHoyBogota(),
      body.descripcion.trim(),
      body.monto,
      body.metodo_salida ?? "EFECTIVO",
      body.etiqueta_id === "" || body.etiqueta_id == null ? null : Number(body.etiqueta_id),
      body.comentario?.trim() ?? "",
      body.reintegrado ?? false,
    ];

    const result = actualizar
      ? await pool.query(
        `UPDATE ${tabla}
         SET fecha = $1, descripcion = $2, monto = $3, metodo_salida = $4,
             etiqueta_id = CASE WHEN $9 THEN $5::integer ELSE etiqueta_id END,
             comentario = CASE WHEN $10 THEN $6 ELSE comentario END,
             reintegrado = CASE WHEN $11 THEN $7::boolean ELSE reintegrado END
         WHERE id = $8
         RETURNING *, fecha::text AS fecha`,
        [...valores, req.params.id, Object.hasOwn(body, "etiqueta_id"),
          Object.hasOwn(body, "comentario"), Object.hasOwn(body, "reintegrado")],
      )
      : await pool.query(
        `INSERT INTO ${tabla}
         (fecha, descripcion, monto, metodo_salida, etiqueta_id, comentario, reintegrado, usuario_id, creado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,timezone('America/Bogota', now()))
         RETURNING *, fecha::text AS fecha`,
        [...valores, req.usuario.id],
      );

    if (!result.rows.length) {
      return res.status(404).json({ ok: false, message: "Gasto no encontrado" });
    }
    return res.status(actualizar ? 200 : 201).json({ ok: true, gasto: result.rows[0] });
  } catch (error) {
    return responderError(res, error, "No se pudo guardar el gasto");
  }
}

async function borrarGasto(req, res, general) {
  if (!idValido(req.params.id)) {
    return res.status(400).json({ ok: false, message: "Gasto no valido" });
  }
  try {
    await asegurarEsquemaCaja();
    const tabla = general ? "caja_general_gastos" : "caja_gastos";
    const result = await pool.query(
      `DELETE FROM ${tabla} WHERE id = $1 RETURNING id`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Gasto no encontrado" });
    }

    res.json({ ok: true, message: "Gasto eliminado" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error eliminando gasto" });
  }
}

export async function obtenerEtiquetasCaja(req, res) {
  try {
    await asegurarEsquemaCaja();
    const result = await pool.query("SELECT id, nombre FROM caja_etiquetas ORDER BY lower(nombre), id");
    res.json({ ok: true, etiquetas: result.rows });
  } catch (error) {
    responderError(res, error, "No se pudieron cargar las etiquetas");
  }
}

export async function crearEtiquetaCaja(req, res) {
  const nombre = typeof req.body?.nombre === "string" ? req.body.nombre.trim() : "";
  if (!nombre || nombre.length > 80) {
    return res.status(400).json({ ok: false, message: "La etiqueta debe tener entre 1 y 80 caracteres" });
  }
  try {
    await asegurarEsquemaCaja();
    const result = await pool.query("INSERT INTO caja_etiquetas (nombre) VALUES ($1) RETURNING id, nombre", [nombre]);
    res.status(201).json({ ok: true, etiqueta: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ ok: false, message: "Ya existe una etiqueta con ese nombre" });
    }
    responderError(res, error, "No se pudo crear la etiqueta");
  }
}

export async function obtenerHistorialGastos(req, res) {
  return obtenerHistorial(req, res, false);
}

export async function obtenerHistorialGeneral(req, res) {
  return obtenerHistorial(req, res, true);
}

async function obtenerHistorial(req, res, general) {
  const mes = req.query.mes || fechaHoyBogota().slice(0, 7);
  const etiqueta = req.query.etiqueta_id || null;
  const estado = req.query.estado || "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || !fechaValida(`${mes}-01`)
    || (etiqueta !== null && !idValido(etiqueta)) || !["", "PENDIENTE", "REINTEGRADO"].includes(estado)) {
    return res.status(400).json({ ok: false, message: "Filtros no validos" });
  }
  try {
    await asegurarEsquemaCaja();
    const tabla = general ? "caja_general_gastos" : "caja_gastos";
    const result = await pool.query(
      `SELECT cg.*, cg.fecha::text AS fecha, u.nombre AS usuario_nombre, ce.nombre AS etiqueta_nombre
       FROM ${tabla} cg
       LEFT JOIN usuarios u ON u.id = cg.usuario_id
       LEFT JOIN caja_etiquetas ce ON ce.id = cg.etiqueta_id
       WHERE cg.fecha >= $1::date AND cg.fecha < $1::date + interval '1 month'
       AND ($2::integer IS NULL OR cg.etiqueta_id = $2::integer)
       AND ($3::boolean IS NULL OR cg.reintegrado = $3::boolean)
       ORDER BY cg.fecha DESC, cg.creado_en DESC, cg.id DESC`,
      [`${mes}-01`, etiqueta, estado ? estado === "REINTEGRADO" : null],
    );
    let totalCentavos = 0;
    let reintegradoCentavos = 0;
    for (const gasto of result.rows) {
      const monto = Math.round(Number(gasto.monto) * 100);
      totalCentavos += monto;
      if (gasto.reintegrado) reintegradoCentavos += monto;
    }
    res.json({
      ok: true,
      mes,
      gastos: result.rows,
      resumen: {
        cantidad: result.rows.length,
        total: totalCentavos / 100,
        reintegrado: reintegradoCentavos / 100,
        pendiente: (totalCentavos - reintegradoCentavos) / 100,
      },
    });
  } catch (error) {
    responderError(res, error, "No se pudo cargar el historial de gastos");
  }
}
