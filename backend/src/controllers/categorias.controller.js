import { pool } from "../config/db.js";

function imagenUrl(req, actual = null) {
  if (!req.file) return actual;
  return `/uploads/categorias/${req.file.filename}`;
}

export async function listarCategorias(req, res) {
  try {
    const result = await pool.query(`
      SELECT *
      FROM categorias_productos
      WHERE activo = true
      ORDER BY nombre ASC
    `);

    res.json({
      ok: true,
      categorias: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error listando categorías",
    });
  }
}

export async function crearCategoria(req, res) {
  try {
    const { nombre, descripcion } = req.body;

    if (!nombre) {
      return res.status(400).json({
        ok: false,
        message: "El nombre de la categoría es obligatorio",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO categorias_productos (
        nombre,
        descripcion,
        imagen_url,
        activo
      )
      VALUES ($1,$2,$3,true)
      RETURNING *
      `,
      [nombre, descripcion || null, imagenUrl(req)]
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
        message: "Ya existe una categoría con ese nombre",
      });
    }

    res.status(500).json({
      ok: false,
      message: "Error creando categoría",
    });
  }
}

export async function actualizarCategoria(req, res) {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;

    const actual = await pool.query(
      `
      SELECT *
      FROM categorias_productos
      WHERE id = $1
      `,
      [id]
    );

    if (actual.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Categoría no encontrada",
      });
    }

    const nuevaImagen = imagenUrl(req, actual.rows[0].imagen_url);

    const result = await pool.query(
      `
      UPDATE categorias_productos
      SET
        nombre = $1,
        descripcion = $2,
        imagen_url = $3,
        activo = $4
      WHERE id = $5
      RETURNING *
      `,
      [
        nombre,
        descripcion || null,
        nuevaImagen,
        activo === "true" || activo === true,
        id,
      ]
    );

    res.json({
      ok: true,
      categoria: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error actualizando categoría",
    });
  }
}

export async function eliminarCategoria(req, res) {
  try {
    const { id } = req.params;

    const productos = await pool.query(
      `
      SELECT producto_id
      FROM producto_categorias
      WHERE categoria_id = $1
      LIMIT 1
      `,
      [id]
    );

    if (productos.rows.length > 0) {
      return res.status(400).json({
        ok: false,
        message: "No puedes eliminar una categoría con productos asignados",
      });
    }

    const result = await pool.query(
      `
      UPDATE categorias_productos
      SET activo = false
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Categoría no encontrada",
      });
    }

    res.json({
      ok: true,
      message: "Categoría eliminada",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error eliminando categoría",
    });
  }
}
