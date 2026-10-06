import { pool } from "../config/db.js";
import { asegurarColumnasProductos } from "../utils/productosSchema.js";

function imagenUrl(req) {
  if (!req.file) return null;
  return `/uploads/productos/${req.file.filename}`;
}

function normalizarCategorias(categorias) {
  if (!categorias) return [];

  if (Array.isArray(categorias)) {
    return categorias.filter(Boolean).map(Number);
  }

  try {
    const parsed = JSON.parse(categorias);
    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean).map(Number);
    }
  } catch {}

  return String(categorias)
    .split(",")
    .filter(Boolean)
    .map(Number);
}

function normalizarComponentes(componentes) {
  if (!componentes) return [];

  let lista = [];

  try {
    lista = Array.isArray(componentes) ? componentes : JSON.parse(componentes || "[]");
  } catch {
    lista = [];
  }

  if (!Array.isArray(lista)) return [];

  return lista
    .map((item) => ({
      componente_producto_id: Number(item.componente_producto_id || item.producto_id),
      cantidad: Number(item.cantidad || 0),
    }))
    .filter((item) => item.componente_producto_id && item.cantidad > 0);
}

async function guardarCategoriasProducto(client, productoId, categorias) {
  await client.query(
    `DELETE FROM producto_categorias WHERE producto_id = $1`,
    [productoId]
  );

  for (const categoriaId of categorias) {
    await client.query(
      `
      INSERT INTO producto_categorias (producto_id, categoria_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [productoId, categoriaId]
    );
  }
}

async function guardarComponentesProducto(client, productoId, componentes) {
  await client.query(`DELETE FROM producto_componentes WHERE producto_id = $1`, [
    productoId,
  ]);

  for (const item of componentes) {
    await client.query(
      `
      INSERT INTO producto_componentes (
        producto_id,
        componente_producto_id,
        cantidad
      )
      VALUES ($1,$2,$3)
      `,
      [productoId, item.componente_producto_id, item.cantidad],
    );
  }
}

export async function obtenerProductos(req, res) {
  try {
    await asegurarColumnasProductos();

    const result = await pool.query(`
      SELECT
        p.*,
        pb.nombre AS producto_base_nombre,
        COALESCE(
          (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', pcmp.id,
                'componente_producto_id', pcmp.componente_producto_id,
                'producto_nombre', pcmp_base.nombre,
                'cantidad', pcmp.cantidad
              )
            )
            FROM producto_componentes pcmp
            INNER JOIN productos pcmp_base ON pcmp_base.id = pcmp.componente_producto_id
            WHERE pcmp.producto_id = p.id
          ),
          '[]'
        ) AS componentes,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', c.id,
              'nombre', c.nombre
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) AS categorias
      FROM productos p
      LEFT JOIN productos pb ON pb.id = p.producto_base_id
      LEFT JOIN producto_categorias pc ON pc.producto_id = p.id
      LEFT JOIN categorias_productos c ON c.id = pc.categoria_id
      WHERE p.eliminado = false
      GROUP BY p.id, pb.nombre
      ORDER BY p.id DESC
    `);

    res.json({
      ok: true,
      productos: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error obteniendo productos" });
  }
}

export async function obtenerProductosMenu(req, res) {
  try {
    await asegurarColumnasProductos();

    const result = await pool.query(`
      SELECT
        p.*,
        pb.nombre AS producto_base_nombre,
        COALESCE(
          (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', pcmp.id,
                'componente_producto_id', pcmp.componente_producto_id,
                'producto_nombre', pcmp_base.nombre,
                'cantidad', pcmp.cantidad
              )
            )
            FROM producto_componentes pcmp
            INNER JOIN productos pcmp_base ON pcmp_base.id = pcmp.componente_producto_id
            WHERE pcmp.producto_id = p.id
          ),
          '[]'
        ) AS componentes,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', c.id,
              'nombre', c.nombre
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) AS categorias
      FROM productos p
      LEFT JOIN productos pb ON pb.id = p.producto_base_id
      LEFT JOIN producto_categorias pc ON pc.producto_id = p.id
      LEFT JOIN categorias_productos c ON c.id = pc.categoria_id
      WHERE p.visible_menu = true
      AND p.activo = true
      AND p.eliminado = false
      GROUP BY p.id, pb.nombre
      ORDER BY p.nombre ASC
    `);

    res.json({
      ok: true,
      productos: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error obteniendo menú" });
  }
}

export async function crearProducto(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await asegurarColumnasProductos(client);

    const {
      nombre,
      descripcion,
      precio_venta,
      descuento_porcentaje,
      visible_menu,
      disponible_venta,
      categorias,
      es_promocion,
      producto_base_id,
      cantidad_base,
      componentes,
    } = req.body;

    const categoriasIds = normalizarCategorias(categorias);
    const componentesNormalizados = normalizarComponentes(componentes);
    const urlImagen = imagenUrl(req);

    const result = await client.query(
      `
      INSERT INTO productos (
        categoria_id,
        nombre,
        descripcion,
        precio_venta,
        descuento_porcentaje,
        imagen_url,
        visible_menu,
        disponible_venta,
        es_promocion,
        producto_base_id,
        cantidad_base,
        activo,
        eliminado
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,false)
      RETURNING *
      `,
      [
        categoriasIds[0] || null,
        nombre,
        descripcion || null,
        precio_venta,
        descuento_porcentaje || 0,
        urlImagen,
        visible_menu === "true" || visible_menu === true,
        disponible_venta === "true" || disponible_venta === true,
        es_promocion === "true" || es_promocion === true,
        producto_base_id || null,
        cantidad_base || 1,
      ]
    );

    await guardarCategoriasProducto(client, result.rows[0].id, categoriasIds);
    await guardarComponentesProducto(
      client,
      result.rows[0].id,
      componentesNormalizados,
    );

    await client.query("COMMIT");

    res.status(201).json({
      ok: true,
      producto: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ ok: false, message: "Error creando producto" });
  } finally {
    client.release();
  }
}

export async function actualizarProducto(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await asegurarColumnasProductos(client);

    const { id } = req.params;

    const actual = await client.query(
      `SELECT * FROM productos WHERE id = $1 AND eliminado = false`,
      [id]
    );

    if (actual.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado",
      });
    }

    const {
      nombre,
      descripcion,
      precio_venta,
      descuento_porcentaje,
      visible_menu,
      disponible_venta,
      activo,
      categorias,
      es_promocion,
      producto_base_id,
      cantidad_base,
      componentes,
    } = req.body;

    const categoriasIds = normalizarCategorias(categorias);
    const componentesNormalizados = normalizarComponentes(componentes);
    const nuevaImagen = imagenUrl(req) || actual.rows[0].imagen_url;

    const result = await client.query(
      `
      UPDATE productos
      SET
        categoria_id = $1,
        nombre = $2,
        descripcion = $3,
        precio_venta = $4,
        descuento_porcentaje = $5,
        imagen_url = $6,
        visible_menu = $7,
        disponible_venta = $8,
        activo = $9,
        es_promocion = $10,
        producto_base_id = $11,
        cantidad_base = $12,
        actualizado_en = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
      `,
      [
        categoriasIds[0] || null,
        nombre,
        descripcion || null,
        precio_venta,
        descuento_porcentaje || 0,
        nuevaImagen,
        visible_menu === "true" || visible_menu === true,
        disponible_venta === "true" || disponible_venta === true,
        activo === "true" || activo === true,
        es_promocion === "true" || es_promocion === true,
        producto_base_id || null,
        cantidad_base || 1,
        id,
      ]
    );

    await guardarCategoriasProducto(client, id, categoriasIds);
    await guardarComponentesProducto(client, id, componentesNormalizados);

    await client.query("COMMIT");

    res.json({
      ok: true,
      producto: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ ok: false, message: "Error actualizando producto" });
  } finally {
    client.release();
  }
}

export async function eliminarProducto(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE productos
      SET eliminado = true,
          activo = false,
          disponible_venta = false,
          visible_menu = false,
          actualizado_en = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado",
      });
    }

    res.json({
      ok: true,
      message: "Producto eliminado",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error eliminando producto" });
  }
}
