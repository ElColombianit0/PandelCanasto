import { pool } from "../config/db.js";

function filtroSucursal(aliasVenta = "v", aliasUsuario = "u", hasSucursal) {
  return hasSucursal
    ? `AND COALESCE(${aliasVenta}.sucursal_id, ${aliasUsuario}.sucursal_id) = $1`
    : "";
}

export async function resumenDashboard(req, res) {
  try {
    const { sucursal_id, productos_periodo = "mes" } = req.query;
    const valores = sucursal_id ? [sucursal_id] : [];
    const filtro = filtroSucursal("v", "u", Boolean(sucursal_id));
    const filtroProductosVendidos =
      productos_periodo === "dia"
        ? "AND pe.cerrado_en::date = (timezone('America/Bogota', now()))::date"
        : `AND pe.cerrado_en >= date_trunc('month', timezone('America/Bogota', now()))
      AND pe.cerrado_en < date_trunc('month', timezone('America/Bogota', now())) + interval '1 month'`;

    const resumenDia = await pool.query(
      `
      SELECT
        COALESCE(SUM(v.total), 0) AS total_ventas,
        COUNT(*) AS cantidad_ventas
      FROM ventas v
      INNER JOIN usuarios u ON u.id = v.usuario_id
      WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
      ${filtro}
      AND v.fecha_venta::date = (timezone('America/Bogota', now()))::date
      `,
      valores,
    );

    const resumenMes = await pool.query(
      `
      SELECT
        COALESCE(SUM(v.total), 0) AS total_ventas_mes,
        COUNT(*) AS cantidad_ventas_mes
      FROM ventas v
      INNER JOIN usuarios u ON u.id = v.usuario_id
      WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
      ${filtro}
      AND v.fecha_venta >= date_trunc('month', timezone('America/Bogota', now()))
      AND v.fecha_venta < date_trunc('month', timezone('America/Bogota', now())) + interval '1 month'
      `,
      valores,
    );

    const ventasDiaDetalle = await pool.query(
      `
      SELECT
        v.id,
        v.total,
        v.subtotal,
        v.propina_valor,
        v.fecha_venta,
        to_char(v.fecha_venta, 'YYYY-MM-DD HH24:MI') AS fecha_venta_colombia,
        v.estado,
        u.nombre AS empleado_nombre,
        s.nombre AS sucursal_nombre,
        f.numero_factura,
        f.tipo_factura,
        mp.nombre AS metodo_pago
      FROM ventas v
      INNER JOIN usuarios u ON u.id = v.usuario_id
      LEFT JOIN sucursales s ON s.id = COALESCE(v.sucursal_id, u.sucursal_id)
      INNER JOIN pagos p ON p.id = v.pago_id
      INNER JOIN metodos_pago mp ON mp.id = p.metodo_pago_id
      LEFT JOIN facturas f ON f.venta_id = v.id
      WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
      ${filtro}
      AND v.fecha_venta::date = (timezone('America/Bogota', now()))::date
      ORDER BY v.fecha_venta DESC
      LIMIT 50
      `,
      valores,
    );

    const ventasPorMetodoPago = await pool.query(
      `
      SELECT
        mp.nombre AS metodo_pago,
        COUNT(v.id) AS cantidad,
        COALESCE(SUM(v.total), 0) AS total
      FROM ventas v
      INNER JOIN usuarios u ON u.id = v.usuario_id
      INNER JOIN pagos p ON p.id = v.pago_id
      INNER JOIN metodos_pago mp ON mp.id = p.metodo_pago_id
      WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
      ${filtro}
      AND v.fecha_venta::date = (timezone('America/Bogota', now()))::date
      GROUP BY mp.nombre
      ORDER BY total DESC
      `,
      valores,
    );

    const ventasMesHistorial = await pool.query(
      `
      SELECT
        v.fecha_venta::date AS fecha,
        COUNT(*) AS cantidad,
        COALESCE(SUM(v.total), 0) AS total
      FROM ventas v
      INNER JOIN usuarios u ON u.id = v.usuario_id
      WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
      ${filtro}
      AND v.fecha_venta >= date_trunc('month', timezone('America/Bogota', now()))
      AND v.fecha_venta < date_trunc('month', timezone('America/Bogota', now())) + interval '1 month'
      GROUP BY fecha
      ORDER BY fecha DESC
      `,
      valores,
    );

    const productosMasVendidos = await pool.query(
      `
      SELECT
        pr.id,
        pr.nombre,
        pr.imagen_url,
        SUM(dp.cantidad) AS cantidad_vendida,
        SUM(dp.subtotal) AS total_vendido
      FROM detalle_pedidos dp
      INNER JOIN productos pr ON pr.id = dp.producto_id
      INNER JOIN pedidos pe ON pe.id = dp.pedido_id
      INNER JOIN ventas v ON v.pedido_id = pe.id
      INNER JOIN usuarios u ON u.id = v.usuario_id
      WHERE pe.estado = 'PAGADO'
      AND COALESCE(v.estado, 'VALIDA') != 'ANULADA'
      ${filtro}
      ${filtroProductosVendidos}
      GROUP BY pr.id, pr.nombre, pr.imagen_url
      ORDER BY cantidad_vendida DESC
      LIMIT 10
      `,
      valores,
    );

    const ventasPorEmpleado = await pool.query(
      `
      SELECT
        u.id,
        u.nombre,
        s.nombre AS sucursal_nombre,
        COUNT(v.id) AS cantidad_ventas,
        COALESCE(SUM(v.total), 0) AS total_vendido
      FROM ventas v
      INNER JOIN usuarios u ON u.id = v.usuario_id
      LEFT JOIN sucursales s ON s.id = COALESCE(v.sucursal_id, u.sucursal_id)
      WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
      ${filtro}
      AND v.fecha_venta >= date_trunc('month', timezone('America/Bogota', now()))
      AND v.fecha_venta < date_trunc('month', timezone('America/Bogota', now())) + interval '1 month'
      GROUP BY u.id, u.nombre, s.nombre
      ORDER BY total_vendido DESC
      `,
      valores,
    );

    const ventasPorSucursal = await pool.query(`
      SELECT
        s.id,
        COALESCE(s.nombre, 'Sin sucursal') AS nombre,
        COUNT(v.id) AS cantidad_ventas,
        COALESCE(SUM(v.total), 0) AS total_vendido
      FROM ventas v
      INNER JOIN usuarios u ON u.id = v.usuario_id
      LEFT JOIN sucursales s ON s.id = COALESCE(v.sucursal_id, u.sucursal_id)
      WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
      AND v.fecha_venta::date = (timezone('America/Bogota', now()))::date
      GROUP BY s.id, s.nombre
      ORDER BY total_vendido DESC
    `);

    const pedidosActivos = await pool.query(`
      SELECT COUNT(*) AS total
      FROM pedidos
      WHERE estado = 'ABIERTO'
    `);

    const mesasOcupadas = await pool.query(`
      SELECT COUNT(*) AS total
      FROM mesas
      WHERE estado = 'OCUPADA'
      AND activo = true
    `);

    const facturasDia = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM facturas f
      LEFT JOIN ventas v ON v.id = f.venta_id
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
      ${filtro}
      AND f.emitida_en::date = (timezone('America/Bogota', now()))::date
      `,
      valores,
    );

    const sucursales = await pool.query(`
      SELECT id, nombre
      FROM sucursales
      WHERE activo = true
      ORDER BY nombre ASC
    `);

    res.json({
      ok: true,
      sucursales: sucursales.rows,
      resumen: {
        total_ventas: Number(resumenDia.rows[0].total_ventas),
        cantidad_ventas: Number(resumenDia.rows[0].cantidad_ventas),
        total_ventas_mes: Number(resumenMes.rows[0].total_ventas_mes),
        cantidad_ventas_mes: Number(resumenMes.rows[0].cantidad_ventas_mes),
        pedidos_activos: Number(pedidosActivos.rows[0].total),
        mesas_ocupadas: Number(mesasOcupadas.rows[0].total),
        facturas_dia: Number(facturasDia.rows[0].total),
      },
      ventas_dia: ventasDiaDetalle.rows,
      ventas_por_metodo_pago: ventasPorMetodoPago.rows,
      ventas_mes_historial: ventasMesHistorial.rows,
      productos_mas_vendidos: productosMasVendidos.rows,
      productos_periodo,
      ventas_por_empleado: ventasPorEmpleado.rows,
      ventas_por_sucursal: ventasPorSucursal.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error obteniendo resumen",
    });
  }
}
