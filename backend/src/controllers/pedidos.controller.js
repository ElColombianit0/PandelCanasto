import { pool } from "../config/db.js";
import { prepararPago, guardarDesglose } from "../utils/pagos.js";
import { asegurarColumnasRecetas } from "../utils/recetasSchema.js";
import { asegurarColumnasProductos } from "../utils/productosSchema.js";

async function recalcularPedido(client, pedidoId) {
  const detalles = await client.query(
    `
    SELECT COALESCE(SUM(subtotal), 0) AS subtotal
    FROM detalle_pedidos
    WHERE pedido_id = $1
    `,
    [pedidoId],
  );

  const subtotal = Number(detalles.rows[0].subtotal || 0);

  const pedidoActual = await client.query(
    `
    SELECT propina_porcentaje
    FROM pedidos
    WHERE id = $1
    `,
    [pedidoId],
  );

  const propinaPorcentaje = Number(
    pedidoActual.rows[0]?.propina_porcentaje || 0,
  );

  const propinaValor = subtotal * (propinaPorcentaje / 100);
  const total = subtotal + propinaValor;

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
    [subtotal, propinaValor, total, pedidoId],
  );

  return {
    subtotal,
    propina_porcentaje: propinaPorcentaje,
    propina_valor: propinaValor,
    total,
  };
}

export async function crearPedidoRapido(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await asegurarColumnasRecetas(client);
    await asegurarColumnasProductos(client);

    const result = await client.query(
      `
      INSERT INTO pedidos (
        usuario_id,
        tipo_pedido,
        estado,
        subtotal,
        descuento_total,
        impuesto_total,
        propina,
        propina_porcentaje,
        propina_valor,
        total
      )
      VALUES ($1, 'RAPIDA', 'ABIERTO', 0, 0, 0, 0, 0, 0, 0)
      RETURNING *
      `,
      [req.usuario.id],
    );

    await client.query("COMMIT");

    res.status(201).json({
      ok: true,
      pedido: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error creando pedido rápido",
    });
  } finally {
    client.release();
  }
}

export async function crearPedidoMesa(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { mesa_id } = req.body;

    const mesa = await client.query(
      `
      SELECT *
      FROM mesas
      WHERE id = $1
      AND activo = true
      `,
      [mesa_id],
    );

    if (mesa.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Mesa no encontrada",
      });
    }

    if (mesa.rows[0].estado === "OCUPADA") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "La mesa ya está ocupada",
      });
    }

    const pedido = await client.query(
      `
      INSERT INTO pedidos (
        mesa_id,
        usuario_id,
        tipo_pedido,
        estado,
        subtotal,
        descuento_total,
        impuesto_total,
        propina,
        propina_porcentaje,
        propina_valor,
        total
      )
      VALUES ($1, $2, 'MESA', 'ABIERTO', 0, 0, 0, 0, 0, 0, 0)
      RETURNING *
      `,
      [mesa_id, req.usuario.id],
    );

    await client.query(
      `
      UPDATE mesas
      SET estado = 'OCUPADA'
      WHERE id = $1
      `,
      [mesa_id],
    );

    await client.query("COMMIT");

    res.status(201).json({
      ok: true,
      pedido: pedido.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error creando pedido de mesa",
    });
  } finally {
    client.release();
  }
}

export async function obtenerPedidosAbiertos(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        p.*,
        m.nombre AS mesa_nombre,
        u.nombre AS empleado_nombre
      FROM pedidos p
      LEFT JOIN mesas m ON m.id = p.mesa_id
      LEFT JOIN usuarios u ON u.id = p.usuario_id
      WHERE p.estado = 'ABIERTO'
      ORDER BY p.abierto_en DESC
    `);

    res.json({
      ok: true,
      pedidos: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error obteniendo pedidos abiertos",
    });
  }
}

export async function obtenerDetallePedido(req, res) {
  try {
    const { id } = req.params;

    const pedido = await pool.query(
      `
      SELECT
        p.*,
        m.nombre AS mesa_nombre,
        u.nombre AS empleado_nombre
      FROM pedidos p
      LEFT JOIN mesas m ON m.id = p.mesa_id
      LEFT JOIN usuarios u ON u.id = p.usuario_id
      WHERE p.id = $1
      `,
      [id],
    );

    if (pedido.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Pedido no encontrado",
      });
    }

    const detalles = await pool.query(
      `
      SELECT
        dp.*,
        pr.nombre AS producto_nombre,
        pr.imagen_url AS producto_imagen
      FROM detalle_pedidos dp
      INNER JOIN productos pr ON pr.id = dp.producto_id
      WHERE dp.pedido_id = $1
      ORDER BY dp.id ASC
      `,
      [id],
    );

    res.json({
      ok: true,
      pedido: pedido.rows[0],
      detalles: detalles.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error obteniendo detalle del pedido",
    });
  }
}

export async function agregarProductoPedido(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { pedido_id, producto_id, cantidad, observacion } = req.body;

    const pedido = await client.query(
      `
      SELECT *
      FROM pedidos
      WHERE id = $1
      AND estado = 'ABIERTO'
      `,
      [pedido_id],
    );

    if (pedido.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Pedido abierto no encontrado",
      });
    }

    const producto = await client.query(
      `
      SELECT *
      FROM productos
      WHERE id = $1
      AND activo = true
      AND disponible_venta = true
      AND eliminado = false
      `,
      [producto_id],
    );

    if (producto.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Producto no disponible",
      });
    }

    const p = producto.rows[0];
    const precio = Number(p.precio_venta);
    const descuento = Number(p.descuento_porcentaje || 0);
    const cantidadFinal = Number(cantidad || 1);

    const precioConDescuento = precio - precio * (descuento / 100);
    const subtotalNuevo = precioConDescuento * cantidadFinal;

    const existente = await client.query(
      `
      SELECT *
      FROM detalle_pedidos
      WHERE pedido_id = $1
      AND producto_id = $2
      LIMIT 1
      `,
      [pedido_id, producto_id],
    );

    let detalle;

    if (existente.rows.length > 0) {
      const nuevaCantidad = Number(existente.rows[0].cantidad) + cantidadFinal;
      const nuevoSubtotal = precioConDescuento * nuevaCantidad;

      detalle = await client.query(
        `
        UPDATE detalle_pedidos
        SET
          cantidad = $1,
          precio_unitario = $2,
          descuento_porcentaje = $3,
          subtotal = $4,
          observacion = COALESCE($5, observacion)
        WHERE id = $6
        RETURNING *
        `,
        [
          nuevaCantidad,
          precio,
          descuento,
          nuevoSubtotal,
          observacion || null,
          existente.rows[0].id,
        ],
      );
    } else {
      detalle = await client.query(
        `
        INSERT INTO detalle_pedidos (
          pedido_id,
          producto_id,
          cantidad,
          precio_unitario,
          descuento_porcentaje,
          subtotal,
          observacion
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        `,
        [
          pedido_id,
          producto_id,
          cantidadFinal,
          precio,
          descuento,
          subtotalNuevo,
          observacion || null,
        ],
      );
    }

    const totales = await recalcularPedido(client, pedido_id);

    await client.query("COMMIT");

    res.status(201).json({
      ok: true,
      detalle: detalle.rows[0],
      totales,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error agregando producto al pedido",
    });
  } finally {
    client.release();
  }
}

export async function eliminarDetallePedido(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;

    const detalle = await client.query(
      `
      DELETE FROM detalle_pedidos
      WHERE id = $1
      RETURNING pedido_id
      `,
      [id],
    );

    if (detalle.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Detalle no encontrado",
      });
    }

    const pedidoId = detalle.rows[0].pedido_id;
    const totales = await recalcularPedido(client, pedidoId);

    await client.query("COMMIT");

    res.json({
      ok: true,
      message: "Producto eliminado del pedido",
      totales,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error eliminando producto del pedido",
    });
  } finally {
    client.release();
  }
}

export async function actualizarCantidadDetallePedido(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const cantidadFinal = Number(req.body.cantidad || 0);

    const detalleActual = await client.query(
      `
      SELECT *
      FROM detalle_pedidos
      WHERE id = $1
      `,
      [id],
    );

    if (detalleActual.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Detalle no encontrado",
      });
    }

    const detalle = detalleActual.rows[0];

    if (cantidadFinal <= 0) {
      await client.query(
        `
        DELETE FROM detalle_pedidos
        WHERE id = $1
        `,
        [id],
      );
    } else {
      const precio = Number(detalle.precio_unitario || 0);
      const descuento = Number(detalle.descuento_porcentaje || 0);
      const precioConDescuento = precio - precio * (descuento / 100);

      await client.query(
        `
        UPDATE detalle_pedidos
        SET
          cantidad = $1,
          subtotal = $2
        WHERE id = $3
        `,
        [cantidadFinal, precioConDescuento * cantidadFinal, id],
      );
    }

    const totales = await recalcularPedido(client, detalle.pedido_id);

    await client.query("COMMIT");

    res.json({
      ok: true,
      totales,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error actualizando cantidad",
    });
  } finally {
    client.release();
  }
}

export async function actualizarPropina(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const { propina_porcentaje } = req.body;

    await client.query(
      `
      UPDATE pedidos
      SET propina_porcentaje = $1
      WHERE id = $2
      AND estado = 'ABIERTO'
      `,
      [Number(propina_porcentaje || 0), id],
    );

    const totales = await recalcularPedido(client, id);

    await client.query("COMMIT");

    res.json({
      ok: true,
      totales,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error actualizando propina",
    });
  } finally {
    client.release();
  }
}

export async function cobrarPedido(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      pedido_id,
      metodo_pago,
      metodo_pago_id,
      metodoPagoId,
      monto_recibido,
      pagos_desglose,
      propina,
      factura_electronica,
      productos = [],
    } = req.body;

    const usuarioId = req.usuario.id;
    const metodoPagoFinal = metodo_pago_id || metodo_pago || metodoPagoId;

    if (!pedido_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "Falta el pedido",
      });
    }

    if (!metodoPagoFinal) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "Debes seleccionar un método de pago",
      });
    }

    const pedidoRes = await client.query(
      `
      SELECT *
      FROM pedidos
      WHERE id = $1
      AND estado = 'ABIERTO'
      FOR UPDATE
      `,
      [pedido_id]
    );

    if (pedidoRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Pedido abierto no encontrado",
      });
    }

    const pedido = pedidoRes.rows[0];

    let detallesRes = await client.query(
      `
      SELECT *
      FROM detalle_pedidos
      WHERE pedido_id = $1
      ORDER BY id ASC
      `,
      [pedido_id]
    );

    if (detallesRes.rows.length === 0 && Array.isArray(productos) && productos.length > 0) {
      for (const prod of productos) {
        const productoId = prod.producto_id || prod.id;

        const productoRes = await client.query(
          `
          SELECT *
          FROM productos
          WHERE id = $1
          AND activo = true
          AND eliminado = false
          `,
          [productoId]
        );

        if (productoRes.rows.length === 0) continue;

        const producto = productoRes.rows[0];
        const cantidad = Number(prod.cantidad || 1);
        const precioUnitario = Number(prod.precio_unitario || producto.precio_venta || 0);
        const descuento = Number(producto.descuento_porcentaje || 0);
        const precioFinal = precioUnitario - precioUnitario * (descuento / 100);
        const subtotalItem = precioFinal * cantidad;

        await client.query(
          `
          INSERT INTO detalle_pedidos (
            pedido_id,
            producto_id,
            cantidad,
            precio_unitario,
            descuento_porcentaje,
            subtotal
          )
          VALUES ($1,$2,$3,$4,$5,$6)
          `,
          [
            pedido_id,
            productoId,
            cantidad,
            precioUnitario,
            descuento,
            subtotalItem,
          ]
        );
      }

      detallesRes = await client.query(
        `
        SELECT *
        FROM detalle_pedidos
        WHERE pedido_id = $1
        ORDER BY id ASC
        `,
        [pedido_id]
      );
    }

    if (detallesRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "El pedido no tiene productos",
      });
    }

    const subtotal = detallesRes.rows.reduce(
      (acc, item) => acc + Number(item.subtotal || 0),
      0
    );

    const propinaPorcentaje =
      propina !== undefined && propina !== null
        ? Number(propina || 0)
        : Number(pedido.propina_porcentaje || 0);

    const propinaValor = Number((subtotal * (propinaPorcentaje / 100)).toFixed(2));
    const total = Number((subtotal + propinaValor).toFixed(2));
    const pagoPreparado = await prepararPago(client, {
      metodo: metodoPagoFinal, desglose: pagos_desglose, recibido: monto_recibido, total,
    });

    const pago = await client.query(
      `
      INSERT INTO pagos (
        pedido_id,
        metodo_pago_id,
        usuario_id,
        subtotal,
        propina,
        propina_porcentaje,
        propina_valor,
        total_pagado,
        monto_recibido,
        cambio,
        estado,
        creado_en
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'APROBADO', timezone('America/Bogota', now()))
      RETURNING *
      `,
      [
        pedido_id,
        pagoPreparado.metodo_pago_id,
        usuarioId,
        subtotal,
        propinaValor,
        propinaPorcentaje,
        propinaValor,
        total,
        pagoPreparado.monto_recibido,
        pagoPreparado.cambio,
      ]
    );

    await guardarDesglose(client, pago.rows[0].id, pagoPreparado.desglose);
    pago.rows[0].pagos_desglose = pagoPreparado.desglose;
    pago.rows[0].efectivo_recibido = pagoPreparado.efectivo_recibido;

    const venta = await client.query(
      `
      INSERT INTO ventas (
        pedido_id,
        pago_id,
        usuario_id,
        subtotal,
        propina,
        propina_porcentaje,
        propina_valor,
        total,
        sucursal_id,
        fecha_venta,
        estado
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,(SELECT sucursal_id FROM usuarios WHERE id = $3), timezone('America/Bogota', now()), 'VALIDA')
      RETURNING *
      `,
      [
        pedido_id,
        pago.rows[0].id,
        usuarioId,
        subtotal,
        propinaValor,
        propinaPorcentaje,
        propinaValor,
        total,
      ]
    );

    const ventaId = venta.rows[0].id;
    const numeroFactura = `POS-${String(ventaId).padStart(6, "0")}`;
    const esFacturaElectronica =
      factura_electronica === true || factura_electronica === "true";
    const tipoFactura = esFacturaElectronica ? "ELECTRONICA" : "POS";

    const factura = await client.query(
      `
      INSERT INTO facturas (
        venta_id,
        usuario_id,
        numero_factura,
        tipo_factura,
        estado,
        sucursal_id,
        emitida_en
      )
      VALUES ($1,$2,$3,$4,'EMITIDA',(SELECT sucursal_id FROM usuarios WHERE id = $2), timezone('America/Bogota', now()))
      RETURNING *
      `,
      [ventaId, usuarioId, numeroFactura, tipoFactura]
    );

    if (esFacturaElectronica) {
      await client.query(
        `
        INSERT INTO facturas_electronicas (
          factura_id,
          proveedor,
          estado_factus,
          respuesta_json,
          creada_en
        )
        VALUES ($1,'FACTUS','PENDIENTE',$2::jsonb, timezone('America/Bogota', now()))
        ON CONFLICT (factura_id) DO NOTHING
        `,
        [
          factura.rows[0].id,
          JSON.stringify({
            origen: "panel_ventas",
            mensaje: "Factura electronica pendiente de envio al proveedor",
          }),
        ],
      );
    }

    for (const item of detallesRes.rows) {
      const productoId = item.producto_id;
      const cantidadVendida = Number(item.cantidad || 1);

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
          const cantidadADescontar =
            cantidadVendida * Number(componente.cantidad || 1);

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
            const cantidadAnterior = Number(inv.cantidad_actual || 0);
            const cantidadNueva = cantidadAnterior - cantidadADescontar;

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
                inv.id,
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
              VALUES ($1,$2,'VENTA',$3,$4,$5,'VENTA_PROMOCION',$6,'Descuento automatico por promocion/combo', timezone('America/Bogota', now()))
              `,
              [
                inv.id,
                usuarioId,
                cantidadADescontar * -1,
                cantidadAnterior,
                cantidadNueva,
                ventaId,
              ],
            );
          }
        }

        continue;
      }

      const recetaRes = await client.query(
        `
        SELECT id, auto_preparar
        FROM recetas
        WHERE producto_id = $1
        AND activo = true
        LIMIT 1
        `,
        [productoId]
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
          `,
          [productoId]
        );

        for (const inv of inventarioDirecto.rows) {
          const cantidadAnterior = Number(inv.cantidad_actual || 0);
          const cantidadNueva = cantidadAnterior - cantidadVendida;

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
              inv.id,
            ]
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
            VALUES ($1,$2,'VENTA',$3,$4,$5,'VENTA',$6,'Descuento automatico por venta directa', timezone('America/Bogota', now()))
            `,
            [
              inv.id,
              usuarioId,
              cantidadVendida * -1,
              cantidadAnterior,
              cantidadNueva,
              ventaId,
            ]
          );
        }
      }

      if (esAutoPreparado) {
        const ingredientesRes = await client.query(
          `
          SELECT
            ri.*,
            i.cantidad_actual,
            i.stock_minimo,
            i.nombre AS inventario_nombre
          FROM receta_ingredientes ri
          INNER JOIN inventario i ON i.id = ri.inventario_id
          WHERE ri.receta_id = $1
          AND ri.activo = true
          FOR UPDATE OF i
          `,
          [recetaRes.rows[0].id]
        );

        for (const ing of ingredientesRes.rows) {
          const cantidadUsada =
            Number(ing.cantidad_usada || 0) * cantidadVendida;

          const cantidadAnterior = Number(ing.cantidad_actual || 0);
          const cantidadNueva = cantidadAnterior - cantidadUsada;

          if (cantidadNueva < 0) {
            const error = new Error(
              `Stock insuficiente para ${ing.inventario_nombre || "inventario"}`,
            );
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
              cantidadNueva <= Number(ing.stock_minimo || 0),
              ing.inventario_id,
            ]
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
            VALUES ($1,$2,'VENTA',$3,$4,$5,'VENTA_AUTO_PREPARACION',$6,'Descuento automatico por venta auto preparada', timezone('America/Bogota', now()))
            `,
            [
              ing.inventario_id,
              usuarioId,
              cantidadUsada * -1,
              cantidadAnterior,
              cantidadNueva,
              ventaId,
            ]
          );
        }
      }
    }

    await client.query(
      `
      UPDATE pedidos
      SET
        estado = 'PAGADO',
        subtotal = $1,
        propina = $2,
        propina_porcentaje = $3,
        propina_valor = $2,
        total = $4,
        cerrado_en = timezone('America/Bogota', now())
      WHERE id = $5
      `,
      [
        subtotal,
        propinaValor,
        propinaPorcentaje,
        total,
        pedido_id,
      ]
    );

    if (pedido.mesa_id) {
      await client.query(
        `
        UPDATE mesas
        SET estado = 'LIBRE'
        WHERE id = $1
        AND estado = 'OCUPADA'
        `,
        [pedido.mesa_id],
      );
    }

    await client.query("COMMIT");

    res.json({
      ok: true,
      message: "Pedido cobrado correctamente",
      pago: pago.rows[0],
      venta: venta.rows[0],
      factura: factura.rows[0],
      detalles: detallesRes.rows,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.statusCode ? error.message : "Error registrando la venta",
      error: error.message,
    });
  } finally {
    client.release();
  }
}
