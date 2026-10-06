import { pool } from "../config/db.js";
import { prepararPago, guardarDesglose, desgloseVentaSQL, centavos } from "../utils/pagos.js";
import { asegurarColumnasRecetas } from "../utils/recetasSchema.js";
import { asegurarColumnasProductos } from "../utils/productosSchema.js";

async function ajustarInventarioPorProductoVenta(
  client,
  { productoId, diferenciaCantidad, ventaId, usuarioId, motivo },
) {
  await asegurarColumnasRecetas(client);
  await asegurarColumnasProductos(client);

  const diferencia = Number(diferenciaCantidad || 0);

  if (!productoId || diferencia === 0) return;

  async function aplicarMovimiento(inv, cantidadPorUnidad, referenciaTipo = "VENTA") {
    const cantidadCambio = Math.abs(diferencia) * Number(cantidadPorUnidad || 0);

    if (cantidadCambio <= 0) return;

    const cantidadAnterior = Number(inv.cantidad_actual || 0);
    const esSalida = diferencia > 0;
    const cantidadNueva = esSalida
      ? cantidadAnterior - cantidadCambio
      : cantidadAnterior + cantidadCambio;

    if (cantidadNueva < 0) {
      const error = new Error(`Stock insuficiente para ${inv.nombre || "inventario"}`);
      error.statusCode = 400;
      throw error;
    }

    await client.query(
      `
      UPDATE inventario
      SET
        cantidad_actual = $1,
        alerta_activa = $2,
        actualizado_en = timezone('America/Bogota', now())
      WHERE id = $3
      `,
      [
        cantidadNueva,
        cantidadNueva <= Number(inv.stock_minimo || 0),
        inv.id || inv.inventario_id,
      ],
    );

    await client.query(
      `
      INSERT INTO movimientos_inventario (
        inventario_id,
        usuario_id,
        tipo_movimiento,
        cantidad,
        cantidad_anterior,
        cantidad_nueva,
        referencia_tipo,
        referencia_id,
        motivo,
        creado_en
      )
      VALUES ($1,$2,'VENTA',$3,$4,$5,$6,$7,$8, timezone('America/Bogota', now()))
      `,
      [
        inv.id || inv.inventario_id,
        usuarioId,
        esSalida ? cantidadCambio * -1 : cantidadCambio,
        cantidadAnterior,
        cantidadNueva,
        referenciaTipo,
        ventaId,
        motivo,
      ],
    );
  }

  const productoVentaRes = await client.query(
    `
    SELECT es_promocion, producto_base_id, cantidad_base
    FROM productos
    WHERE id = $1
    `,
    [productoId],
  );

  const productoVenta = productoVentaRes.rows[0] || {};

  const componentesCombo = await client.query(
    `
    SELECT componente_producto_id, cantidad
    FROM producto_componentes
    WHERE producto_id = $1
    `,
    [productoId],
  );

  const componentesPromocion =
    componentesCombo.rows.length > 0
      ? componentesCombo.rows
      : productoVenta.es_promocion && productoVenta.producto_base_id
        ? [
            {
              componente_producto_id: productoVenta.producto_base_id,
              cantidad: productoVenta.cantidad_base || 1,
            },
          ]
        : [];

  if (componentesPromocion.length > 0) {
    for (const componente of componentesPromocion) {
      const inventarioPromocion = await client.query(
        `
        SELECT *
        FROM inventario
        WHERE producto_venta_id = $1
        AND descontar_en_venta = true
        AND activo = true
        FOR UPDATE
        `,
        [componente.componente_producto_id],
      );

      for (const inv of inventarioPromocion.rows) {
        await aplicarMovimiento(
          inv,
          Number(componente.cantidad || 1),
          "VENTA_PROMOCION",
        );
      }
    }

    return;
  }

  const recetaRes = await client.query(
    `
    SELECT id, auto_preparar
    FROM recetas
    WHERE producto_id = $1
    AND activo = true
    LIMIT 1
    `,
    [productoId],
  );

  const esAutoPreparado =
    recetaRes.rows.length > 0 && recetaRes.rows[0].auto_preparar;

  if (!esAutoPreparado) {
    const inventarioDirecto = await client.query(
      `
      SELECT *
      FROM inventario
      WHERE producto_venta_id = $1
      AND descontar_en_venta = true
      AND activo = true
      FOR UPDATE
      `,
      [productoId],
    );

    for (const inv of inventarioDirecto.rows) {
      await aplicarMovimiento(inv, 1);
    }

    return;
  }

  const ingredientesRes = await client.query(
    `
    SELECT
      ri.inventario_id,
      ri.cantidad_usada,
      i.nombre,
      i.cantidad_actual,
      i.stock_minimo
    FROM receta_ingredientes ri
    INNER JOIN inventario i ON i.id = ri.inventario_id
    WHERE ri.receta_id = $1
    AND ri.activo = true
    FOR UPDATE OF i
    `,
    [recetaRes.rows[0].id],
  );

  for (const ing of ingredientesRes.rows) {
    await aplicarMovimiento(
      ing,
      Number(ing.cantidad_usada || 0),
      "VENTA_AUTO_PREPARACION",
    );
  }
}

export async function listarVentas(req, res) {
  try {
    const { fecha, usuario_id, sucursal_id, page = 1, limit = 20 } = req.query;

    const pagina = Math.max(Number(page), 1);
    const limite = Math.min(Math.max(Number(limit), 1), 100);
    const offset = (pagina - 1) * limite;

    const filtros = [];
    const valores = [];

    if (fecha) {
      valores.push(fecha);
      filtros.push(`v.fecha_venta::date = $${valores.length}::date`);
    }

    if (usuario_id) {
      valores.push(usuario_id);
      filtros.push(`v.usuario_id = $${valores.length}`);
    }

    if (sucursal_id) {
      valores.push(sucursal_id);
      filtros.push(`COALESCE(v.sucursal_id, u.sucursal_id) = $${valores.length}`);
    }

    const where = filtros.length > 0 ? `WHERE ${filtros.join(" AND ")}` : "";
    const whereValidas =
      filtros.length > 0
        ? `WHERE ${filtros.join(" AND ")} AND COALESCE(v.estado, 'VALIDA') != 'ANULADA'`
        : "WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'";

    const result = await pool.query(
      `
      SELECT
        v.*,
        to_char(v.fecha_venta, 'YYYY-MM-DD HH24:MI') AS fecha_venta_colombia,
        u.nombre AS empleado_nombre,
        s.nombre AS sucursal_nombre,
        f.numero_factura,
        f.tipo_factura,
        p.monto_recibido,
        p.cambio,
        mp.nombre AS metodo_pago,
        ${desgloseVentaSQL} AS pagos_desglose
      FROM ventas v
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      LEFT JOIN sucursales s ON s.id = COALESCE(v.sucursal_id, u.sucursal_id)
      LEFT JOIN facturas f ON f.venta_id = v.id
      LEFT JOIN pagos p ON p.id = v.pago_id
      LEFT JOIN metodos_pago mp ON mp.id = p.metodo_pago_id
      ${where}
      ORDER BY v.fecha_venta DESC
      LIMIT $${valores.length + 1}
      OFFSET $${valores.length + 2}
      `,
      [...valores, limite, offset],
    );

    const totalRegistros = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM ventas v
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      ${where}
      `,
      valores,
    );

    const resumen = await pool.query(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
        ) AS cantidad_validas,
        COALESCE(
          SUM(v.total) FILTER (
            WHERE COALESCE(v.estado, 'VALIDA') != 'ANULADA'
          ),
          0
        ) AS total_validas,
        COUNT(*) FILTER (
          WHERE COALESCE(v.estado, 'VALIDA') = 'ANULADA'
        ) AS cantidad_anuladas
      FROM ventas v
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      ${where}
      `,
      valores,
    );

    const resumenMetodosPago = await pool.query(
      `
      SELECT
        vp.metodo_pago,
        COUNT(DISTINCT v.id) AS cantidad,
        COALESCE(SUM(vp.monto), 0) AS total
      FROM ventas v
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      LEFT JOIN ventas_pagos_desglose vp ON vp.venta_id = v.id
      ${whereValidas}
      GROUP BY vp.metodo_pago
      ORDER BY total DESC
      `,
      valores,
    );

    const usuarios = await pool.query(`
      SELECT id, nombre, rol, sucursal_id
      FROM usuarios
      WHERE rol IN ('ADMIN', 'EMPLEADO')
      ${sucursal_id ? "AND (sucursal_id = $1 OR rol = 'ADMIN')" : ""}
      ORDER BY nombre ASC
    `, sucursal_id ? [sucursal_id] : []);

    const sucursales = await pool.query(`
      SELECT id, nombre
      FROM sucursales
      WHERE activo = true
      ORDER BY nombre ASC
    `);

    res.json({
      ok: true,
      ventas: result.rows,
      resumen: {
        total_registros: Number(totalRegistros.rows[0].total),
        cantidad_validas: Number(resumen.rows[0].cantidad_validas),
        cantidad_anuladas: Number(resumen.rows[0].cantidad_anuladas),
        total_validas: Number(resumen.rows[0].total_validas),
        metodos_pago: resumenMetodosPago.rows,
        page: pagina,
        limit: limite,
        total_pages: Math.ceil(Number(totalRegistros.rows[0].total) / limite),
      },
      usuarios: usuarios.rows,
      sucursales: sucursales.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error listando ventas",
    });
  }
}

export async function obtenerVenta(req, res) {
  try {
    const { id } = req.params;

    const venta = await pool.query(
      `
      SELECT
        v.*,
        to_char(v.fecha_venta, 'YYYY-MM-DD HH24:MI') AS fecha_venta_colombia,
        u.nombre AS empleado_nombre,
        f.numero_factura,
        f.tipo_factura,
        f.cliente_nombre,
        f.cliente_documento,
        f.cliente_email,
        p.monto_recibido,
        p.cambio,
        mp.nombre AS metodo_pago,
        ${desgloseVentaSQL} AS pagos_desglose
      FROM ventas v
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      LEFT JOIN facturas f ON f.venta_id = v.id
      LEFT JOIN pagos p ON p.id = v.pago_id
      LEFT JOIN metodos_pago mp ON mp.id = p.metodo_pago_id
      WHERE v.id = $1
      `,
      [id],
    );

    if (venta.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Venta no encontrada",
      });
    }

    const detalles = await pool.query(
      `
      SELECT
        dp.*,
        pr.nombre AS producto_nombre
      FROM detalle_pedidos dp
      INNER JOIN productos pr ON pr.id = dp.producto_id
      WHERE dp.pedido_id = $1
      ORDER BY dp.id ASC
      `,
      [venta.rows[0].pedido_id],
    );

    const config = await pool.query(`
      SELECT *
      FROM configuracion_factura
      ORDER BY id ASC
      LIMIT 1
    `);

    res.json({
      ok: true,
      venta: venta.rows[0],
      detalles: detalles.rows,
      config: config.rows[0] || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error obteniendo venta",
    });
  }
}

export async function actualizarDetalleVenta(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const { detalles, motivo } = req.body;

    if (!Array.isArray(detalles)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "Debes enviar el detalle de productos",
      });
    }

    if (!motivo) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "Debes escribir el motivo de la corrección",
      });
    }

    const ventaActual = await client.query(
      `
      SELECT *
      FROM ventas
      WHERE id = $1
      AND COALESCE(estado, 'VALIDA') != 'ANULADA'
      FOR UPDATE
      `,
      [id],
    );

    if (ventaActual.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Venta no encontrada o anulada",
      });
    }

    const venta = ventaActual.rows[0];
    const detallesAnteriores = await client.query(
      `
      SELECT id, producto_id, cantidad
      FROM detalle_pedidos
      WHERE pedido_id = $1
      `,
      [venta.pedido_id],
    );

    for (const item of detalles) {
      const cantidad = Number(item.cantidad || 0);
      const precioUnitario = Number(item.precio_unitario || 0);
      const descuento = Number(item.descuento_porcentaje || 0);
      const precioConDescuento =
        precioUnitario - precioUnitario * (descuento / 100);

      if (cantidad <= 0) {
        await client.query(
          `
          DELETE FROM detalle_pedidos
          WHERE id = $1
          AND pedido_id = $2
          `,
          [item.id, venta.pedido_id],
        );
      } else {
        const subtotal = precioConDescuento * cantidad;

        await client.query(
          `
          UPDATE detalle_pedidos
          SET
            cantidad = $1,
            subtotal = $2
          WHERE id = $3
          AND pedido_id = $4
          `,
          [cantidad, subtotal, item.id, venta.pedido_id],
        );
      }
    }

    const detallesActualizados = await client.query(
      `
      SELECT id, producto_id, cantidad
      FROM detalle_pedidos
      WHERE pedido_id = $1
      `,
      [venta.pedido_id],
    );

    const cantidadesAnteriores = new Map();
    const cantidadesNuevas = new Map();

    for (const item of detallesAnteriores.rows) {
      const productoId = Number(item.producto_id);
      cantidadesAnteriores.set(
        productoId,
        (cantidadesAnteriores.get(productoId) || 0) +
          Number(item.cantidad || 0),
      );
    }

    for (const item of detallesActualizados.rows) {
      const productoId = Number(item.producto_id);
      cantidadesNuevas.set(
        productoId,
        (cantidadesNuevas.get(productoId) || 0) + Number(item.cantidad || 0),
      );
    }

    const productoIds = new Set([
      ...cantidadesAnteriores.keys(),
      ...cantidadesNuevas.keys(),
    ]);

    for (const productoId of productoIds) {
      const diferenciaCantidad =
        (cantidadesNuevas.get(productoId) || 0) -
        (cantidadesAnteriores.get(productoId) || 0);

      await ajustarInventarioPorProductoVenta(client, {
        productoId,
        diferenciaCantidad,
        ventaId: id,
        usuarioId: req.usuario.id,
        motivo: `Correccion de venta: ${motivo}`,
      });
    }

    const subtotalResult = await client.query(
      `
      SELECT COALESCE(SUM(subtotal), 0) AS subtotal
      FROM detalle_pedidos
      WHERE pedido_id = $1
      `,
      [venta.pedido_id],
    );

    const subtotalNuevo = Number(subtotalResult.rows[0].subtotal || 0);
    const porcentaje = Number(venta.propina_porcentaje || 0);
    const propinaValor = Number((subtotalNuevo * (porcentaje / 100)).toFixed(2));
    const totalNuevo = Number((subtotalNuevo + propinaValor).toFixed(2));
    const { rows: [pagoActual] } = await client.query("SELECT * FROM pagos WHERE id = $1 FOR UPDATE", [venta.pago_id]);
    const { rows: partesActuales } = await client.query("SELECT * FROM ventas_pagos_desglose WHERE venta_id = $1", [id]);
    const eraMixto = partesActuales.length > 1;
    const noEfectivo = partesActuales.filter((p) => !/efectivo/i.test(p.metodo_pago)).reduce((s, p) => s + Number(p.monto), 0);
    const recibido = req.body.efectivo_recibido ?? Number((Number(pagoActual.monto_recibido || 0) - noEfectivo).toFixed(2));
    const partesCorregidas = req.body.pagos_desglose || partesActuales;
    if (eraMixto && totalNuevo > 0 && (!Array.isArray(partesCorregidas) || partesCorregidas.reduce((s, p) => s + centavos(p?.monto), 0) !== centavos(totalNuevo))) {
      throw Object.assign(new Error("Actualiza el reparto del pago para que coincida con el total corregido."), { statusCode: 400 });
    }
    const pagoCorregido = totalNuevo > 0 ? await prepararPago(client, {
      metodo: eraMixto ? (partesCorregidas.length === 1 ? partesCorregidas[0].metodo_pago_id : "MIXTO") : pagoActual.metodo_pago_id,
      desglose: partesCorregidas, recibido, total: totalNuevo,
    }) : { metodo_pago_id: pagoActual.metodo_pago_id, monto_recibido: Number(pagoActual.monto_recibido || 0), cambio: Math.max(recibido, 0), desglose: [] };

    await client.query(
      `
      UPDATE pedidos
      SET
        subtotal = $1,
        propina = $2,
        propina_valor = $2,
        total = $3
      WHERE id = $4
      `,
      [subtotalNuevo, propinaValor, totalNuevo, venta.pedido_id],
    );

    await client.query(
      `
      UPDATE ventas
      SET
        subtotal = $1,
        propina = $2,
        propina_valor = $2,
        total = $3
      WHERE id = $4
      `,
      [subtotalNuevo, propinaValor, totalNuevo, id],
    );

    await client.query(
      `
      UPDATE pagos
      SET
        subtotal = $1,
        propina = $2,
        propina_valor = $2,
        total_pagado = $3,
        cambio = $5,
        monto_recibido = $6,
        metodo_pago_id = $7
      WHERE id = $4
      `,
      [subtotalNuevo, propinaValor, totalNuevo, venta.pago_id, pagoCorregido.cambio, pagoCorregido.monto_recibido, pagoCorregido.metodo_pago_id],
    );
    await guardarDesglose(client, venta.pago_id, pagoCorregido.desglose);

    await client.query(
      `
      INSERT INTO auditoria_ventas (
        venta_id,
        admin_id,
        accion,
        motivo,
        total_anterior,
        total_nuevo
      )
      VALUES ($1,$2,'CORREGIR_PRODUCTOS',$3,$4,$5)
      `,
      [id, req.usuario.id, motivo, venta.total, totalNuevo],
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      message: "Venta corregida correctamente",
      total_nuevo: totalNuevo,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.statusCode ? error.message : "Error corrigiendo venta",
    });
  } finally {
    client.release();
  }
}

export async function anularVenta(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const { motivo } = req.body;

    if (!motivo) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "Debes escribir el motivo de la anulación",
      });
    }

    const ventaActual = await client.query(
      `
      SELECT *
      FROM ventas
      WHERE id = $1
      AND COALESCE(estado, 'VALIDA') != 'ANULADA'
      FOR UPDATE
      `,
      [id],
    );

    if (ventaActual.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Venta no encontrada o ya anulada",
      });
    }

    const venta = ventaActual.rows[0];

    await client.query(
      `
      UPDATE ventas
      SET estado = 'ANULADA'
      WHERE id = $1
      `,
      [id],
    );

    await client.query(
      `
      UPDATE facturas
      SET estado = 'ANULADA'
      WHERE venta_id = $1
      `,
      [id],
    );

    await client.query(
      `
      INSERT INTO auditoria_ventas (
        venta_id,
        admin_id,
        accion,
        motivo,
        total_anterior,
        total_nuevo
      )
      VALUES ($1,$2,'ANULAR',$3,$4,0)
      `,
      [id, req.usuario.id, motivo, venta.total],
    );

    const movimientos = await client.query(
      `
      SELECT
        inventario_id,
        SUM(cantidad) AS cantidad_neta
      FROM movimientos_inventario
      WHERE referencia_tipo IN ('VENTA', 'VENTA_PROMOCION')
      AND referencia_id = $1
      AND tipo_movimiento = 'VENTA'
      GROUP BY inventario_id
      `,
      [id],
    );

    for (const mov of movimientos.rows) {
      const cantidadNeta = Number(mov.cantidad_neta || 0);

      if (cantidadNeta >= 0) continue;

      const inventarioActual = await client.query(
        `
    SELECT cantidad_actual, stock_minimo
    FROM inventario
    WHERE id = $1
    `,
        [mov.inventario_id],
      );

      if (inventarioActual.rows.length === 0) continue;

      const cantidadAnterior = Number(
        inventarioActual.rows[0].cantidad_actual || 0,
      );
      const cantidadDevolver = Math.abs(cantidadNeta);
      const cantidadNueva = cantidadAnterior + cantidadDevolver;

      await client.query(
        `
    UPDATE inventario
    SET
      cantidad_actual = $1,
      alerta_activa = $2,
      actualizado_en = timezone('America/Bogota', now())
    WHERE id = $3
    `,
        [
          cantidadNueva,
          cantidadNueva <= Number(inventarioActual.rows[0].stock_minimo || 0),
          mov.inventario_id,
        ],
      );

      await client.query(
        `
    INSERT INTO movimientos_inventario (
      inventario_id,
      usuario_id,
      tipo_movimiento,
      cantidad,
      cantidad_anterior,
      cantidad_nueva,
      referencia_tipo,
      referencia_id,
      motivo,
      creado_en
    )
    VALUES ($1,$2,'AJUSTE',$3,$4,$5,'VENTA_ANULADA',$6,'Devolucion automatica por anulacion de venta', timezone('America/Bogota', now()))
    `,
        [
          mov.inventario_id,
          req.usuario.id,
          cantidadDevolver,
          cantidadAnterior,
          cantidadNueva,
          id,
        ],
      );
    }

    const movimientosAutoPreparacion = await client.query(
      `
      SELECT
        inventario_id,
        SUM(cantidad) AS cantidad_neta
      FROM movimientos_inventario
      WHERE referencia_tipo = 'VENTA_AUTO_PREPARACION'
      AND referencia_id = $1
      AND tipo_movimiento = 'VENTA'
      GROUP BY inventario_id
      `,
      [id],
    );

    for (const mov of movimientosAutoPreparacion.rows) {
      const cantidadNeta = Number(mov.cantidad_neta || 0);

      if (cantidadNeta >= 0) continue;

      const inventarioActual = await client.query(
        `
    SELECT cantidad_actual, stock_minimo
    FROM inventario
    WHERE id = $1
    `,
        [mov.inventario_id],
      );

      if (inventarioActual.rows.length === 0) continue;

      const cantidadAnterior = Number(
        inventarioActual.rows[0].cantidad_actual || 0,
      );
      const cantidadDevolver = Math.abs(cantidadNeta);
      const cantidadNueva = cantidadAnterior + cantidadDevolver;

      await client.query(
        `
    UPDATE inventario
    SET
      cantidad_actual = $1,
      alerta_activa = $2,
      actualizado_en = timezone('America/Bogota', now())
    WHERE id = $3
    `,
        [
          cantidadNueva,
          cantidadNueva <= Number(inventarioActual.rows[0].stock_minimo || 0),
          mov.inventario_id,
        ],
      );

      await client.query(
        `
    INSERT INTO movimientos_inventario (
      inventario_id,
      usuario_id,
      tipo_movimiento,
      cantidad,
      cantidad_anterior,
      cantidad_nueva,
      referencia_tipo,
      referencia_id,
      motivo,
      creado_en
    )
    VALUES ($1,$2,'AJUSTE',$3,$4,$5,'VENTA_ANULADA_AUTO_PREPARACION',$6,'Devolucion de ingredientes por anulacion de venta auto preparada', timezone('America/Bogota', now()))
    `,
        [
          mov.inventario_id,
          req.usuario.id,
          cantidadDevolver,
          cantidadAnterior,
          cantidadNueva,
          id,
        ],
      );
    }

    await client.query("COMMIT");

    res.json({
      ok: true,
      message: "Venta anulada correctamente",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error anulando venta",
    });
  } finally {
    client.release();
  }
}

export async function auditoriaVenta(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        a.*,
        to_char(a.creado_en, 'YYYY-MM-DD HH24:MI') AS creado_en_colombia,
        u.nombre AS admin_nombre
      FROM auditoria_ventas a
      LEFT JOIN usuarios u ON u.id = a.admin_id
      WHERE a.venta_id = $1
      ORDER BY a.creado_en DESC
      `,
      [id],
    );

    res.json({
      ok: true,
      auditoria: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error obteniendo auditoría",
    });
  }
}
