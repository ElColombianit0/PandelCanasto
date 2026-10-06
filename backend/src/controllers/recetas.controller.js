import { pool } from "../config/db.js";
import { asegurarColumnasRecetas } from "../utils/recetasSchema.js";

function getRecetaId(req) {
  return req.params.recetaId || req.params.id;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cantidadParaCosto(cantidad, unidad = "") {
  const cantidadNumerica = toNumber(cantidad, 0);
  const unidadNormalizada = String(unidad || "").trim().toLowerCase();

  if (
    [
      "g",
      "gr",
      "gr.",
      "gramo",
      "gramos",
      "ml",
      "ml.",
      "mililitro",
      "mililitros",
    ].includes(unidadNormalizada)
  ) {
    return cantidadNumerica / 1000;
  }

  return cantidadNumerica;
}

function normalizeRecipePayload(body) {
  return {
    producto_id: body.producto_id ? Number(body.producto_id) : null,
    nombre: String(body.nombre || "").trim(),
    descripcion: body.descripcion ? String(body.descripcion).trim() : null,
    auto_preparar:
      body.auto_preparar === true ||
      body.auto_preparar === "true" ||
      body.auto_preparar === "1",
    unidades_resultantes: toNumber(body.unidades_resultantes, 1) || 1,
    tiempo_mano_obra_horas: toNumber(body.tiempo_mano_obra_horas, 0),
    consumo_luz_kwh: toNumber(body.consumo_luz_kwh, 0),
    consumo_gas: toNumber(body.consumo_gas, 0),
    margen_sugerido_porcentaje: toNumber(body.margen_sugerido_porcentaje, 30),
    ingredientes: Array.isArray(body.ingredientes) ? body.ingredientes : [],
  };
}

function normalizeIngredientes(ingredientes) {
  return ingredientes
    .map((ing) => ({
      id: ing.id ? Number(ing.id) : null,
      inventario_id: ing.inventario_id ? Number(ing.inventario_id) : null,
      cantidad_usada: toNumber(ing.cantidad_usada, 0),
    }))
    .filter((ing) => ing.inventario_id && ing.cantidad_usada > 0);
}

export async function recalcularReceta(
  client,
  recetaId,
  usuarioId,
  motivo = "Recalculo de receta",
) {
  const recetaRes = await client.query(`SELECT * FROM recetas WHERE id = $1`, [
    recetaId,
  ]);

  if (recetaRes.rows.length === 0) return null;

  const receta = recetaRes.rows[0];

  const ingredientesRes = await client.query(
    `
    SELECT
      ri.*,
      i.nombre AS inventario_nombre,
      i.costo_unitario,
      um.abreviatura AS unidad_abreviatura
    FROM receta_ingredientes ri
    LEFT JOIN inventario i ON i.id = ri.inventario_id
    LEFT JOIN unidades_medida um ON um.id = i.unidad_medida_id
    WHERE ri.receta_id = $1
    AND ri.activo = true
    `,
    [recetaId],
  );

  let costoIngredientes = 0;

  for (const ing of ingredientesRes.rows) {
    const costoUnitario = Number(ing.costo_unitario || 0);
    const cantidadUsada = Number(ing.cantidad_usada || 0);
    const costoTotal =
      costoUnitario * cantidadParaCosto(cantidadUsada, ing.unidad_abreviatura);

    costoIngredientes += costoTotal;

    await client.query(
      `
      UPDATE receta_ingredientes
      SET
        costo_unitario_momento = $1,
        costo_total = $2
      WHERE id = $3
      `,
      [costoUnitario, costoTotal, ing.id],
    );
  }

  const costosVars = await client.query(`
    SELECT *
    FROM costos_variables
    WHERE activo = true
  `);

  let costoLuz = 0;
  let costoGas = 0;
  let costoManoObra = 0;

  for (const cv of costosVars.rows) {
    const valor = Number(cv.valor || 0);

    if (cv.nombre === "kwh_luz") {
      costoLuz = valor * Number(receta.consumo_luz_kwh || 0);
    }

    if (cv.nombre === "gas") {
      costoGas = valor * Number(receta.consumo_gas || 0);
    }

    if (cv.nombre === "mano_obra_hora") {
      costoManoObra = valor * Number(receta.tiempo_mano_obra_horas || 0);
    }
  }

  const costoVariablesTotal = costoLuz + costoGas + costoManoObra;
  const costoTotal = costoIngredientes + costoVariablesTotal;
  const unidades = Number(receta.unidades_resultantes || 1);
  const costoUnitario = unidades > 0 ? costoTotal / unidades : costoTotal;
  const margen = Number(receta.margen_sugerido_porcentaje || 30);
  const precioSugerido = costoUnitario + costoUnitario * (margen / 100);

  await client.query(
    `
    INSERT INTO historial_costos_recetas (
      receta_id,
      usuario_id,
      costo_total_anterior,
      costo_total_nuevo,
      costo_unitario_anterior,
      costo_unitario_nuevo,
      motivo
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      recetaId,
      usuarioId,
      Number(receta.costo_total || 0),
      costoTotal,
      Number(receta.costo_unitario || 0),
      costoUnitario,
      motivo,
    ],
  );

  const updated = await client.query(
    `
    UPDATE recetas
    SET
      costo_ingredientes = $1,
      costo_variables = $2,
      costo_total = $3,
      costo_unitario = $4,
      precio_sugerido = $5,
      actualizado_en = timezone('America/Bogota', now())
    WHERE id = $6
    RETURNING *
    `,
    [
      costoIngredientes,
      costoVariablesTotal,
      costoTotal,
      costoUnitario,
      precioSugerido,
      recetaId,
    ],
  );

  return updated.rows[0];
}

export async function listarRecetas(req, res) {
  try {
    await asegurarColumnasRecetas();

    // Primero, obtenemos todas las recetas activas con el nombre del producto
    const { rows: recetas } = await pool.query(`
      SELECT
        r.*,
        p.nombre AS producto_nombre
      FROM recetas r
      LEFT JOIN productos p ON p.id = r.producto_id
      WHERE r.activo = true
      ORDER BY r.nombre ASC
    `);

    // Para cada receta, buscamos sus ingredientes y los datos del inventario
    for (const receta of recetas) {
      try {
        const { rows: ingredientes } = await pool.query(
          `SELECT
         ri.id,
         ri.inventario_id,
         ri.cantidad_usada,
         inv.nombre AS inventario_nombre,
         inv.costo_unitario,
         um.abreviatura AS unidad_abreviatura
       FROM receta_ingredientes ri
       LEFT JOIN inventario inv ON inv.id = ri.inventario_id
       LEFT JOIN unidades_medida um ON um.id = inv.unidad_medida_id
       WHERE ri.receta_id = $1
       AND ri.activo = true
       ORDER BY inv.nombre`,
          [receta.id],
        );
        receta.ingredientes = ingredientes;
      } catch (err) {
        console.warn(
          `Error cargando ingredientes para receta ${receta.id}:`,
          err.message,
        );
        receta.ingredientes = [];
      }
    }

    // Devolvemos todas las recetas con los ingredientes incluidos
    res.json({
      ok: true,
      recetas,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error listando recetas",
    });
  }
}

export async function crearReceta(req, res) {
  const client = await pool.connect();
  const recetaData = normalizeRecipePayload(req.body);
  const ingredientes = normalizeIngredientes(recetaData.ingredientes);

  try {
    await client.query("BEGIN");
    await asegurarColumnasRecetas(client);

    if (!recetaData.nombre) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "El nombre de la receta es obligatorio",
      });
    }

    if (recetaData.producto_id) {
      const existing = await client.query(
        `SELECT id FROM recetas WHERE producto_id = $1 AND activo = true`,
        [recetaData.producto_id],
      );

      if (existing.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          message: "Ya existe una receta activa para este producto",
        });
      }
    }

    const recetaResult = await client.query(
      `
      INSERT INTO recetas (
        producto_id,
        nombre,
        descripcion,
        unidades_resultantes,
        tiempo_mano_obra_horas,
        consumo_luz_kwh,
        consumo_gas,
        margen_sugerido_porcentaje,
        auto_preparar,
        activo,
        creado_en
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,timezone('America/Bogota', now()))
      RETURNING *
      `,
      [
        recetaData.producto_id,
        recetaData.nombre,
        recetaData.descripcion,
        recetaData.unidades_resultantes,
        recetaData.tiempo_mano_obra_horas,
        recetaData.consumo_luz_kwh,
        recetaData.consumo_gas,
        recetaData.margen_sugerido_porcentaje,
        recetaData.auto_preparar,
      ],
    );

    const receta = recetaResult.rows[0];

    for (const ing of ingredientes) {
      await client.query(
        `
        INSERT INTO receta_ingredientes (
          receta_id,
          inventario_id,
          cantidad_usada
        )
        VALUES ($1,$2,$3)
        `,
        [receta.id, ing.inventario_id, ing.cantidad_usada],
      );
    }

    const recetaActualizada = await recalcularReceta(
      client,
      receta.id,
      req.usuario.id,
      "Receta creada",
    );

    await client.query("COMMIT");

    res.status(201).json({ ok: true, receta: recetaActualizada || receta });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    if (error.code === "23505") {
      return res.status(400).json({
        ok: false,
        message: "Ya existe una receta para este producto",
      });
    }

    res.status(500).json({ ok: false, message: "Error creando la receta" });
  } finally {
    client.release();
  }
}

export async function agregarIngrediente(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { recetaId } = req.params;
    const { inventario_id, cantidad_usada } = req.body;

    await client.query(
      `
      INSERT INTO receta_ingredientes (
        receta_id,
        inventario_id,
        cantidad_usada
      )
      VALUES ($1,$2,$3)
      `,
      [recetaId, inventario_id, cantidad_usada],
    );

    const recetaActualizada = await recalcularReceta(
      client,
      recetaId,
      req.usuario.id,
      "Ingrediente agregado",
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      receta: recetaActualizada,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error agregando ingrediente",
    });
  } finally {
    client.release();
  }
}

export async function actualizarIngrediente(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { recetaId, ingredienteId } = req.params;
    const { inventario_id, cantidad_usada } = req.body;

    await client.query(
      `
      UPDATE receta_ingredientes
      SET
        inventario_id = COALESCE($1, inventario_id),
        cantidad_usada = $2,
        activo = true
      WHERE id = $3
      AND receta_id = $4
      `,
      [inventario_id || null, cantidad_usada, ingredienteId, recetaId],
    );

    const recetaActualizada = await recalcularReceta(
      client,
      recetaId,
      req.usuario.id,
      "Cantidad de ingrediente actualizada",
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      receta: recetaActualizada,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error actualizando ingrediente",
    });
  } finally {
    client.release();
  }
}

// src/controllers/recetas.controller.js
export async function detalleReceta(req, res) {
  const id = getRecetaId(req);

  try {
    // 1️⃣ Traer los datos generales de la receta junto con el nombre del producto
    const recetaResult = await pool.query(
      `
      SELECT
        r.*,
        p.nombre AS producto_nombre
      FROM recetas r
      LEFT JOIN productos p ON r.producto_id = p.id
      WHERE r.id = $1 AND r.activo = true
      `,
      [id]
    );

    if (recetaResult.rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Receta no encontrada" });
    }

    const receta = recetaResult.rows[0];

    // 2️⃣ Traer los ingredientes de la receta
    const ingredientesResult = await pool.query(
      `
      SELECT 
        ri.id AS receta_ingrediente_id,
        i.id AS inventario_id,
        i.nombre AS inventario_nombre,
        i.costo_unitario,
        COALESCE(um.abreviatura, '') AS unidad,
        ri.cantidad_usada
      FROM receta_ingredientes ri
      JOIN inventario i ON ri.inventario_id = i.id
      LEFT JOIN unidades_medida um ON i.unidad_medida_id = um.id
      WHERE ri.receta_id = $1
      AND ri.activo = true
      ORDER BY i.nombre ASC
      `,
      [id]
    );

    // 3️⃣ Asignar los ingredientes al objeto receta
    receta.ingredientes = ingredientesResult.rows || [];

    // 4️⃣ Devolver la receta con sus ingredientes al frontend
    res.json({
      ok: true,
      receta,
    });
  } catch (error) {
    console.error("Error en detalleReceta:", error);
    res.status(500).json({
      ok: false,
      message: "Error obteniendo detalle de la receta",
    });
  }
}

export async function datosBaseRecetas(req, res) {
  try {
    const [inventario, productos] = await Promise.all([
      pool.query(`
        SELECT
          i.id,
          i.nombre,
          i.costo_unitario,
          i.cantidad_actual,
          i.stock_minimo,
          um.abreviatura,
          um.tipo
        FROM inventario i
        LEFT JOIN unidades_medida um ON um.id = i.unidad_medida_id
        WHERE i.activo = true
        ORDER BY i.nombre ASC
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
      inventario: inventario.rows,
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

export async function listarCostosVariables(req, res) {
  try {
    const result = await pool.query(`
      SELECT *
      FROM costos_variables
      WHERE activo = true
      ORDER BY nombre ASC
    `);

    res.json({
      ok: true,
      costos: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error listando costos variables",
    });
  }
}

export async function actualizarCostoVariable(req, res) {
  try {
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
      [valor, id],
    );

    res.json({
      ok: true,
      costoVariable: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error actualizando costo variable",
    });
  }
}

export async function prepararReceta(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await asegurarColumnasRecetas(client);

    const id = getRecetaId(req);
    const cantidadPreparada = toNumber(req.body.cantidad_preparada, 1);

    const recetaRes = await client.query(
      `
      SELECT *
      FROM recetas
      WHERE id = $1
      AND activo = true
      `,
      [id],
    );

    if (recetaRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Receta no encontrada",
      });
    }

    const receta = recetaRes.rows[0];

    if (receta.auto_preparar) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message:
          "Esta receta esta marcada como auto preparada y se descuenta al vender el producto",
      });
    }

    if (cantidadPreparada <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "La cantidad a preparar debe ser mayor a cero",
      });
    }

    const ingredientes = await client.query(
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
      [id],
    );

    if (ingredientes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "La receta no tiene ingredientes configurados",
      });
    }

    for (const ing of ingredientes.rows) {
      const cantidadADescontar =
        Number(ing.cantidad_usada || 0) * cantidadPreparada;

      const cantidadAnterior = Number(ing.cantidad_actual || 0);
      const cantidadNueva = cantidadAnterior - cantidadADescontar;

      if (cantidadNueva < 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          message: `Stock insuficiente para ${ing.inventario_nombre}`,
        });
      }
    }

    const historial = await client.query(
      `
      INSERT INTO historial_recetas (
        receta_id,
        usuario_id,
        creado_en
      )
      VALUES ($1,$2,timezone('America/Bogota', now()))
      RETURNING *
      `,
      [id, req.usuario.id],
    );

    const historialId = historial.rows[0].id;

    for (const ing of ingredientes.rows) {
      const cantidadADescontar =
        Number(ing.cantidad_usada || 0) * cantidadPreparada;

      const cantidadAnterior = Number(ing.cantidad_actual || 0);
      const cantidadNueva = cantidadAnterior - cantidadADescontar;

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
        VALUES ($1,$2,'SALIDA',$3,$4,$5,'PREPARACION_RECETA',$6,'Preparacion de receta', timezone('America/Bogota', now()))
        `,
        [
          ing.inventario_id,
          req.usuario.id,
          cantidadADescontar * -1,
          cantidadAnterior,
          cantidadNueva,
          historialId,
        ],
      );

      await client.query(
        `
        INSERT INTO historial_receta_ingredientes (
          historial_receta_id,
          inventario_id,
          cantidad_usada,
          receta_ingrediente_id
        )
        VALUES ($1,$2,$3,$4)
        `,
        [historialId, ing.inventario_id, cantidadADescontar, ing.id],
      );
    }

    const cantidadProducida =
      Number(receta.unidades_resultantes || 0) * cantidadPreparada;

    if (receta.producto_id && cantidadProducida > 0) {
      const inventarioProducto = await client.query(
        `
        SELECT *
        FROM inventario
        WHERE producto_venta_id = $1
        AND activo = true
        FOR UPDATE
        `,
        [receta.producto_id],
      );

      for (const item of inventarioProducto.rows) {
        const cantidadAnterior = Number(item.cantidad_actual || 0);
        const cantidadNueva = cantidadAnterior + cantidadProducida;

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
            cantidadNueva <= Number(item.stock_minimo || 0),
            item.id,
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
          VALUES ($1,$2,'ENTRADA',$3,$4,$5,'PREPARACION_RECETA',$6,'Entrada automatica por preparacion de receta', timezone('America/Bogota', now()))
          `,
          [
            item.id,
            req.usuario.id,
            cantidadProducida,
            cantidadAnterior,
            cantidadNueva,
            historialId,
          ],
        );
      }
    }

    await client.query("COMMIT");

    res.json({
      ok: true,
      message: "Receta preparada correctamente",
      historial: {
        ...historial.rows[0],
        receta_nombre: receta.nombre,
        costo_total: Number(receta.costo_total || 0) * cantidadPreparada,
        costo_unitario: receta.costo_unitario,
        cantidad_producida: cantidadProducida,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error preparando receta",
    });
  } finally {
    client.release();
  }
}

export async function historialPreparaciones(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        hr.*,
        to_char(hr.creado_en, 'YYYY-MM-DD HH24:MI') AS creado_en_colombia,
        to_char(hr.cancelada_en, 'YYYY-MM-DD HH24:MI') AS cancelada_en_colombia,
        r.nombre AS receta_nombre,
        u.nombre AS usuario_nombre,
        cu.nombre AS cancelada_por_nombre
      FROM historial_recetas hr
      LEFT JOIN recetas r ON r.id = hr.receta_id
      LEFT JOIN usuarios u ON u.id = hr.usuario_id
      LEFT JOIN usuarios cu ON cu.id = hr.cancelada_por
      ORDER BY hr.creado_en DESC
      LIMIT 200
      `,
    );

    res.json({
      ok: true,
      historial: result.rows,
      preparaciones: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error obteniendo historial",
    });
  }
}

export async function actualizarReceta(req, res) {
  const client = await pool.connect();
  const id = getRecetaId(req);
  const recetaData = normalizeRecipePayload(req.body);
  const ingredientes = normalizeIngredientes(recetaData.ingredientes);

  try {
    await client.query("BEGIN");
    await asegurarColumnasRecetas(client);

    if (!recetaData.nombre) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "El nombre de la receta es obligatorio",
      });
    }

    if (recetaData.producto_id) {
      const existing = await client.query(
        `
        SELECT id
        FROM recetas
        WHERE producto_id = $1
        AND activo = true
        AND id <> $2
        `,
        [recetaData.producto_id, id],
      );

      if (existing.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          message: "Ya existe una receta activa para este producto",
        });
      }
    }

    const result = await client.query(
      `
      UPDATE recetas
      SET
        producto_id = $1,
        nombre = $2,
        descripcion = $3,
        unidades_resultantes = $4,
        tiempo_mano_obra_horas = $5,
        consumo_luz_kwh = $6,
        consumo_gas = $7,
        margen_sugerido_porcentaje = $8,
        auto_preparar = $9,
        actualizado_en = timezone('America/Bogota', now())
      WHERE id = $10
      AND activo = true
      RETURNING *
      `,
      [
        recetaData.producto_id,
        recetaData.nombre,
        recetaData.descripcion,
        recetaData.unidades_resultantes,
        recetaData.tiempo_mano_obra_horas,
        recetaData.consumo_luz_kwh,
        recetaData.consumo_gas,
        recetaData.margen_sugerido_porcentaje,
        recetaData.auto_preparar,
        id,
      ],
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Receta no encontrada",
      });
    }

    const idsActuales = ingredientes
      .filter((ing) => ing.id)
      .map((ing) => ing.id);

    await client.query(
      `
      UPDATE receta_ingredientes
      SET activo = false
      WHERE receta_id = $1
      AND activo = true
      AND NOT (id = ANY($2::int[]))
      `,
      [id, idsActuales],
    );

    for (const ing of ingredientes) {
      if (ing.id) {
        const updated = await client.query(
          `
          UPDATE receta_ingredientes
          SET
            inventario_id = $1,
            cantidad_usada = $2,
            activo = true
          WHERE id = $3
          AND receta_id = $4
          RETURNING id
          `,
          [ing.inventario_id, ing.cantidad_usada, ing.id, id],
        );

        if (updated.rows.length > 0) continue;
      }

      await client.query(
        `
        INSERT INTO receta_ingredientes (
          receta_id,
          inventario_id,
          cantidad_usada
        )
        VALUES ($1,$2,$3)
        `,
        [id, ing.inventario_id, ing.cantidad_usada],
      );
    }

    const recetaActualizada = await recalcularReceta(
      client,
      id,
      req.usuario.id,
      "Receta actualizada",
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      receta: recetaActualizada || result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    if (error.code === "23505") {
      return res.status(400).json({
        ok: false,
        message: "Ya existe una receta para este producto",
      });
    }

    res.status(500).json({
      ok: false,
      message: "Error actualizando receta",
    });
  } finally {
    client.release();
  }
}

export async function eliminarReceta(req, res) {
  try {
    const id = getRecetaId(req);

    await pool.query(
      `
      UPDATE recetas
      SET activo = false,
          actualizado_en = timezone('America/Bogota', now())
      WHERE id = $1
      `,
      [id],
    );

    res.json({
      ok: true,
      message: "Receta eliminada",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error eliminando receta",
    });
  }
}

export async function realizarReceta(req, res) {
  return prepararReceta(req, res);
}

export async function cancelarReceta(req, res) {
  const client = await pool.connect();
  const historialId = req.params.historialId || req.params.recetaId || req.params.id;

  try {
    await client.query("BEGIN");

    const historialRes = await client.query(
      `
      SELECT *
      FROM historial_recetas
      WHERE id = $1
      AND cancelada = false
      FOR UPDATE
      `,
      [historialId],
    );

    if (historialRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Historial no encontrado o ya cancelado",
      });
    }

    const ingredientesRes = await client.query(
      `
      SELECT
        hri.inventario_id,
        hri.cantidad_usada,
        i.cantidad_actual,
        i.stock_minimo
      FROM historial_receta_ingredientes hri
      INNER JOIN inventario i ON i.id = hri.inventario_id
      WHERE hri.historial_receta_id = $1
      FOR UPDATE OF i
      `,
      [historialId],
    );

    for (const ing of ingredientesRes.rows) {
      const cantidadAnterior = Number(ing.cantidad_actual || 0);
      const cantidadNueva = cantidadAnterior + Number(ing.cantidad_usada || 0);

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
        VALUES ($1,$2,'AJUSTE',$3,$4,$5,'PREPARACION_RECETA_CANCELADA',$6,'Cancelacion de preparacion de receta', timezone('America/Bogota', now()))
        `,
        [
          ing.inventario_id,
          req.usuario.id,
          Number(ing.cantidad_usada || 0),
          cantidadAnterior,
          cantidadNueva,
          historialId,
        ],
      );
    }

    const recetaProductoRes = await client.query(
      `
      SELECT
        r.producto_id,
        r.unidades_resultantes
      FROM historial_recetas hr
      INNER JOIN recetas r ON r.id = hr.receta_id
      WHERE hr.id = $1
      `,
      [historialId],
    );

    if (recetaProductoRes.rows.length > 0) {
      const recetaProducto = recetaProductoRes.rows[0];
      const cantidadProducida = Number(recetaProducto.unidades_resultantes || 0);

      if (recetaProducto.producto_id && cantidadProducida > 0) {
        const inventarioProducto = await client.query(
          `
          SELECT *
          FROM inventario
          WHERE producto_venta_id = $1
          AND activo = true
          FOR UPDATE
          `,
          [recetaProducto.producto_id],
        );

        for (const item of inventarioProducto.rows) {
          const cantidadAnterior = Number(item.cantidad_actual || 0);
          const cantidadNueva = Math.max(cantidadAnterior - cantidadProducida, 0);

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
              cantidadNueva <= Number(item.stock_minimo || 0),
              item.id,
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
            VALUES ($1,$2,'AJUSTE',$3,$4,$5,'PREPARACION_RECETA_CANCELADA',$6,'Salida automatica por cancelacion de preparacion', timezone('America/Bogota', now()))
            `,
            [
              item.id,
              req.usuario.id,
              (cantidadAnterior - cantidadNueva) * -1,
              cantidadAnterior,
              cantidadNueva,
              historialId,
            ],
          );
        }
      }
    }

    await client.query(
      `
      UPDATE historial_recetas
      SET
        cancelada = true,
        cancelada_por = $1,
        cancelada_en = timezone('America/Bogota', now())
      WHERE id = $2
      `,
      [req.usuario.id, historialId],
    );

    await client.query("COMMIT");

    res.json({ ok: true, message: "Receta cancelada y stock repuesto" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error cancelando receta:", error);
    res.status(500).json({ ok: false, message: "Error al cancelar receta" });
  } finally {
    client.release();
  }
}
