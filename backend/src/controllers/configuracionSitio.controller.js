import { pool } from "../config/db.js";

let bannersColumnasVerificadas = false;

async function asegurarColumnasBanners() {
  if (bannersColumnasVerificadas) return;

  await pool.query(`
    ALTER TABLE banners_home
    ADD COLUMN IF NOT EXISTS mostrar_informacion BOOLEAN NOT NULL DEFAULT FALSE
  `);

  bannersColumnasVerificadas = true;
}

function booleanoDesdeForm(valor, fallback = false) {
  if (valor === undefined || valor === null || valor === "") return fallback;
  return valor === true || valor === "true" || valor === "on" || valor === "1";
}

function imagenUrl(req) {
  if (!req.file) return null;
  return `/uploads/banners/${req.file.filename}`;
}

/* CONFIGURACIÓN GENERAL */

export async function obtenerConfiguracionSitio(req, res) {
  try {
    await pool.query(
      `
      INSERT INTO configuracion_sitio (clave, valor, tipo)
      VALUES ('home_mostrar_informacion', 'false', 'boolean')
      ON CONFLICT (clave) DO NOTHING
      `,
    );

    const result = await pool.query(`
      SELECT *
      FROM configuracion_sitio
      ORDER BY clave ASC
    `);

    res.json({
      ok: true,
      configuraciones: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error obteniendo configuración",
    });
  }
}

export async function guardarConfiguracionSitio(req, res) {
  try {
    const configuraciones = req.body;

    for (const item of configuraciones) {
      await pool.query(
        `
        INSERT INTO configuracion_sitio (clave, valor, tipo, actualizado_en)
        VALUES ($2, $1, COALESCE($3, 'texto'), timezone('America/Bogota', now()))
        ON CONFLICT (clave) DO UPDATE
        SET
          valor = EXCLUDED.valor,
          tipo = EXCLUDED.tipo,
          actualizado_en = timezone('America/Bogota', now())
        `,
        [item.valor, item.clave, item.tipo || null]
      );
    }

    res.json({
      ok: true,
      message: "Configuración actualizada",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error guardando configuración",
    });
  }
}

/* BANNERS HOME */

export async function obtenerBanners(req, res) {
  try {
    await asegurarColumnasBanners();

    const result = await pool.query(`
      SELECT *
      FROM banners_home
      ORDER BY orden ASC, id DESC
    `);

    res.json({
      ok: true,
      banners: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error obteniendo banners",
    });
  }
}

export async function crearBanner(req, res) {
  try {
    await asegurarColumnasBanners();

    const {
      titulo,
      subtitulo,
      boton_texto,
      boton_link,
      orden,
      activo,
      mostrar_informacion,
    } = req.body;

    const imagen = imagenUrl(req);

    const result = await pool.query(
      `
      INSERT INTO banners_home (
        titulo,
        subtitulo,
        imagen_url,
        boton_texto,
        boton_link,
        orden,
        activo,
        mostrar_informacion
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        titulo,
        subtitulo,
        imagen,
        boton_texto,
        boton_link,
        orden || 0,
        booleanoDesdeForm(activo, true),
        booleanoDesdeForm(mostrar_informacion, false),
      ]
    );

    res.status(201).json({
      ok: true,
      banner: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error creando banner",
    });
  }
}

export async function actualizarBanner(req, res) {
  try {
    await asegurarColumnasBanners();

    const { id } = req.params;

    const actual = await pool.query(
      `SELECT * FROM banners_home WHERE id = $1`,
      [id]
    );

    if (actual.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Banner no encontrado",
      });
    }

    const {
      titulo,
      subtitulo,
      boton_texto,
      boton_link,
      orden,
      activo,
      mostrar_informacion,
    } = req.body;

    const nuevaImagen =
      imagenUrl(req) || actual.rows[0].imagen_url;

    const result = await pool.query(
      `
      UPDATE banners_home
      SET
        titulo = $1,
        subtitulo = $2,
        imagen_url = $3,
        boton_texto = $4,
        boton_link = $5,
        orden = $6,
        activo = $7,
        mostrar_informacion = $8
      WHERE id = $9
      RETURNING *
      `,
      [
        titulo,
        subtitulo,
        nuevaImagen,
        boton_texto,
        boton_link,
        orden || 0,
        booleanoDesdeForm(activo, actual.rows[0].activo),
        booleanoDesdeForm(
          mostrar_informacion,
          actual.rows[0].mostrar_informacion,
        ),
        id,
      ]
    );

    res.json({
      ok: true,
      banner: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error actualizando banner",
    });
  }
}

export async function eliminarBanner(req, res) {
  try {
    const { id } = req.params;

    await pool.query(
      `DELETE FROM banners_home WHERE id = $1`,
      [id]
    );

    res.json({
      ok: true,
      message: "Banner eliminado",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error eliminando banner",
    });
  }
}
