import { pool } from "../config/db.js";
import { asegurarTablasOperaciones } from "../utils/operacionesSchema.js";

function fechaHoyBogota() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());
}

export async function obtenerCierreCaja(req, res) {
  try {
    await asegurarTablasOperaciones();

    const fecha = req.query.fecha || fechaHoyBogota();

    const ventas = await pool.query(
      `
      SELECT
        mp.nombre AS metodo_pago,
        COUNT(v.id) AS cantidad,
        COALESCE(SUM(v.total), 0) AS total
      FROM ventas v
      INNER JOIN pagos p ON p.id = v.pago_id
      INNER JOIN metodos_pago mp ON mp.id = p.metodo_pago_id
      WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
      AND v.fecha_venta::date = $1::date
      GROUP BY mp.nombre
      ORDER BY mp.nombre
      `,
      [fecha],
    );

    const gastos = await pool.query(
      `
      SELECT cg.*, u.nombre AS usuario_nombre
      FROM caja_gastos cg
      LEFT JOIN usuarios u ON u.id = cg.usuario_id
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
  try {
    await asegurarTablasOperaciones();

    const { fecha = fechaHoyBogota(), descripcion, monto, metodo_salida = "EFECTIVO" } = req.body;

    if (!descripcion || Number(monto || 0) <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Debes ingresar descripcion y monto del gasto",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO caja_gastos (
        fecha,
        descripcion,
        monto,
        metodo_salida,
        usuario_id,
        creado_en
      )
      VALUES ($1,$2,$3,$4,$5,timezone('America/Bogota', now()))
      RETURNING *
      `,
      [fecha, descripcion, monto, metodo_salida, req.usuario.id],
    );

    res.status(201).json({ ok: true, gasto: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error registrando gasto" });
  }
}

export async function actualizarGastoCaja(req, res) {
  try {
    await asegurarTablasOperaciones();

    const { id } = req.params;
    const { fecha = fechaHoyBogota(), descripcion, monto, metodo_salida = "EFECTIVO" } = req.body;

    if (!descripcion || Number(monto || 0) <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Debes ingresar descripcion y monto del gasto",
      });
    }

    const result = await pool.query(
      `
      UPDATE caja_gastos
      SET
        fecha = $1,
        descripcion = $2,
        monto = $3,
        metodo_salida = $4
      WHERE id = $5
      RETURNING *
      `,
      [fecha, descripcion, monto, metodo_salida, id],
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

export async function eliminarGastoCaja(req, res) {
  try {
    await asegurarTablasOperaciones();

    const { id } = req.params;
    const result = await pool.query(
      `
      DELETE FROM caja_gastos
      WHERE id = $1
      RETURNING id
      `,
      [id],
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
