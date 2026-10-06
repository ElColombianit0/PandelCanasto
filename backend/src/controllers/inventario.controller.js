import { pool } from "../config/db.js";

export async function listarInventario(req, res) {
  try {
    const {
      categoria_id,
      bajo_stock,
      buscar,
    } = req.query;

    const filtros = ["i.activo = true"];
    const valores = [];

    if (categoria_id) {
      valores.push(categoria_id);
      filtros.push(`i.categoria_id = $${valores.length}`);
    }

    if (bajo_stock === "true") {
      filtros.push(`i.cantidad_actual <= i.stock_minimo`);
    }

    if (buscar) {
      valores.push(`%${buscar}%`);
      filtros.push(`i.nombre ILIKE $${valores.length}`);
    }

    const where = filtros.length
      ? `WHERE ${filtros.join(" AND ")}`
      : "";

    const result = await pool.query(
      `
      SELECT
        i.*,
        ci.nombre AS categoria_nombre,
        um.nombre AS unidad_nombre,
        um.abreviatura AS unidad_abreviatura,
        p.nombre AS producto_venta_nombre
      FROM inventario i
      LEFT JOIN categorias_inventario ci ON ci.id = i.categoria_id
      LEFT JOIN unidades_medida um ON um.id = i.unidad_medida_id
      LEFT JOIN productos p ON p.id = i.producto_venta_id
      ${where}
      ORDER BY i.nombre ASC
      `,
      valores
    );

    res.json({
      ok: true,
      inventario: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error listando inventario",
    });
  }
}

export async function crearInventario(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      categoria_id,
      unidad_medida_id,
      nombre,
      descripcion,
      cantidad_actual,
      stock_minimo,
      costo_unitario,
      descontar_en_venta,
      producto_venta_id,
    } = req.body;

    const result = await client.query(
      `
      INSERT INTO inventario (
        categoria_id,
        unidad_medida_id,
        nombre,
        descripcion,
        cantidad_actual,
        stock_minimo,
        alerta_activa,
        costo_unitario,
        descontar_en_venta,
        producto_venta_id,
        activo
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
      RETURNING *
      `,
      [
        categoria_id || null,
        unidad_medida_id,
        nombre,
        descripcion || null,
        cantidad_actual || 0,
        stock_minimo || 0,
        Number(cantidad_actual || 0) <= Number(stock_minimo || 0),
        costo_unitario || 0,
        descontar_en_venta === true || descontar_en_venta === "true",
        producto_venta_id || null,
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
        motivo
      )
      VALUES ($1,$2,'CREACION',$3,0,$3,'Creación inicial de inventario')
      `,
      [
        result.rows[0].id,
        req.usuario.id,
        Number(cantidad_actual || 0),
      ]
    );

    await client.query(
  `
  INSERT INTO historial_costos_inventario (
    inventario_id,
    costo_anterior,
    costo_nuevo,
    usuario_id,
    motivo
  )
  VALUES ($1,0,$2,$3,'Costo inicial')
  `,
  [
    result.rows[0].id,
    Number(costo_unitario || 0),
    req.usuario.id,
  ]
);

    await client.query("COMMIT");

    res.status(201).json({
      ok: true,
      item: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error creando inventario",
    });
  } finally {
    client.release();
  }
}

export async function actualizarInventario(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;

    const actual = await client.query(
      `SELECT * FROM inventario WHERE id = $1`,
      [id]
    );

    if (actual.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Item de inventario no encontrado",
      });
    }

    const anterior = actual.rows[0];

    const {
      categoria_id,
      unidad_medida_id,
      nombre,
      descripcion,
      cantidad_actual,
      stock_minimo,
      costo_unitario,
      descontar_en_venta,
      producto_venta_id,
      motivo,
    } = req.body;

    const cantidadAnterior = Number(anterior.cantidad_actual || 0);
    const cantidadNueva = Number(cantidad_actual || 0);

    const costoAnterior = Number(anterior.costo_unitario || 0);
    const costoNuevo = Number(costo_unitario || 0);

    const result = await client.query(
      `
      UPDATE inventario
      SET
        categoria_id = $1,
        unidad_medida_id = $2,
        nombre = $3,
        descripcion = $4,
        cantidad_actual = $5,
        stock_minimo = $6,
        alerta_activa = $7,
        costo_unitario = $8,
        descontar_en_venta = $9,
        producto_venta_id = $10,
        actualizado_en = timezone('America/Bogota', now())
      WHERE id = $11
      RETURNING *
      `,
      [
        categoria_id || null,
        unidad_medida_id,
        nombre,
        descripcion || null,
        cantidadNueva,
        stock_minimo || 0,
        cantidadNueva <= Number(stock_minimo || 0),
        costoNuevo,
        descontar_en_venta === true || descontar_en_venta === "true",
        producto_venta_id || null,
        id,
      ]
    );

    if (cantidadAnterior !== cantidadNueva) {
      await client.query(
        `
        INSERT INTO movimientos_inventario (
          inventario_id,
          usuario_id,
          tipo_movimiento,
          cantidad,
          cantidad_anterior,
          cantidad_nueva,
          motivo
        )
        VALUES ($1,$2,'AJUSTE',$3,$4,$5,$6)
        `,
        [
          id,
          req.usuario.id,
          cantidadNueva - cantidadAnterior,
          cantidadAnterior,
          cantidadNueva,
          motivo || "Ajuste manual de inventario",
        ]
      );
    }

    if (costoAnterior !== costoNuevo) {
      await client.query(
        `
        INSERT INTO historial_costos_inventario (
          inventario_id,
          costo_anterior,
          costo_nuevo,
          usuario_id,
          motivo
        )
        VALUES ($1,$2,$3,$4,$5)
        `,
        [
          id,
          costoAnterior,
          costoNuevo,
          req.usuario.id,
          motivo || "Cambio de costo unitario",
        ]
      );
    }

    await client.query("COMMIT");

    res.json({
      ok: true,
      item: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error actualizando inventario",
    });
  } finally {
    client.release();
  }
}

export async function agregarStockInventario(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const { cantidad, costo_unitario, motivo } = req.body;
    const cantidadAgregar = Number(cantidad || 0);

    if (!Number.isFinite(cantidadAgregar) || cantidadAgregar <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "Ingresa una cantidad mayor a cero",
      });
    }

    const actual = await client.query(
      `
      SELECT *
      FROM inventario
      WHERE id = $1
      AND activo = true
      FOR UPDATE
      `,
      [id],
    );

    if (actual.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Item de inventario no encontrado",
      });
    }

    const item = actual.rows[0];
    const cantidadAnterior = Number(item.cantidad_actual || 0);
    const cantidadNueva = cantidadAnterior + cantidadAgregar;
    const costoAnterior = Number(item.costo_unitario || 0);
    const costoNuevo =
      costo_unitario !== undefined && costo_unitario !== null && costo_unitario !== ""
        ? Number(costo_unitario || 0)
        : costoAnterior;

    const result = await client.query(
      `
      UPDATE inventario
      SET
        cantidad_actual = $1,
        alerta_activa = $2,
        costo_unitario = $3,
        actualizado_en = timezone('America/Bogota', now())
      WHERE id = $4
      RETURNING *
      `,
      [
        cantidadNueva,
        cantidadNueva <= Number(item.stock_minimo || 0),
        costoNuevo,
        id,
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
        motivo,
        creado_en
      )
      VALUES ($1,$2,'ENTRADA',$3,$4,$5,$6,timezone('America/Bogota', now()))
      `,
      [
        id,
        req.usuario.id,
        cantidadAgregar,
        cantidadAnterior,
        cantidadNueva,
        motivo || "Entrada rápida de inventario",
      ],
    );

    if (costoAnterior !== costoNuevo) {
      await client.query(
        `
        INSERT INTO historial_costos_inventario (
          inventario_id,
          costo_anterior,
          costo_nuevo,
          usuario_id,
          motivo
        )
        VALUES ($1,$2,$3,$4,$5)
        `,
        [
          id,
          costoAnterior,
          costoNuevo,
          req.usuario.id,
          motivo || "Cambio de costo en entrada rápida",
        ],
      );
    }

    await client.query("COMMIT");

    res.json({
      ok: true,
      item: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error agregando stock",
    });
  } finally {
    client.release();
  }
}

export async function eliminarInventario(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE inventario
      SET activo = false,
          actualizado_en = timezone('America/Bogota', now())
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Item de inventario no encontrado",
      });
    }

    res.json({
      ok: true,
      message: "Item de inventario desactivado",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error eliminando inventario",
    });
  }
}

export async function movimientosInventario(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        mi.*,
        u.nombre AS usuario_nombre
      FROM movimientos_inventario mi
      LEFT JOIN usuarios u ON u.id = mi.usuario_id
      WHERE mi.inventario_id = $1
      ORDER BY mi.creado_en DESC
      LIMIT 100
      `,
      [id]
    );

    res.json({
      ok: true,
      movimientos: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error obteniendo movimientos",
    });
  }
}

export async function historialCostosInventario(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        h.*,
        u.nombre AS usuario_nombre
      FROM historial_costos_inventario h
      LEFT JOIN usuarios u ON u.id = h.usuario_id
      WHERE h.inventario_id = $1
      ORDER BY h.creado_en DESC
      LIMIT 100
      `,
      [id]
    );

    res.json({
      ok: true,
      historial: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error obteniendo historial de costos",
    });
  }
}

export async function datosBaseInventario(req, res) {
  try {
    const [categorias, unidades, productos] = await Promise.all([
      pool.query(`
        SELECT *
        FROM categorias_inventario
        WHERE activo = true
        ORDER BY nombre ASC
      `),
      pool.query(`
        SELECT *
        FROM unidades_medida
        ORDER BY id ASC
      `),
      pool.query(`
        SELECT id, nombre
        FROM productos
        WHERE eliminado = false
        AND activo = true
        ORDER BY nombre ASC
      `),
    ]);

    res.json({
      ok: true,
      categorias: categorias.rows,
      unidades: unidades.rows,
      productos: productos.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error obteniendo datos base",
    });
  }
}

export async function crearCategoriaInventario(req, res) {
  try {
    const { nombre, descripcion } = req.body;

    const result = await pool.query(
      `
      INSERT INTO categorias_inventario (
        nombre,
        descripcion,
        activo
      )
      VALUES ($1,$2,true)
      RETURNING *
      `,
      [nombre, descripcion || null]
    );

    res.status(201).json({
      ok: true,
      categoria: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      return res.status(400).json({
        ok: false,
        message: "Ya existe esa categoría",
      });
    }

    res.status(500).json({
      ok: false,
      message: "Error creando categoría",
    });
  }
}
