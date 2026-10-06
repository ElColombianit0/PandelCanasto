import { pool } from "../config/db.js";

function logoUrl(req, actualLogo) {
  if (!req.file) return actualLogo || null;
  return `/uploads/factura/${req.file.filename}`;
}

export async function obtenerConfiguracionFactura(req, res) {
  try {
    const result = await pool.query(`
      SELECT *
      FROM configuracion_factura
      ORDER BY id ASC
      LIMIT 1
    `);

    res.json({
      ok: true,
      configuracion: result.rows[0] || null,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error obteniendo configuración",
    });
  }
}

export async function actualizarConfiguracionFactura(req, res) {
  try {
    const {
      razon_social,
      nit,
      direccion,
      telefono,
      email,
      prefijo_factura,
      resolucion_dian,
      mensaje_inferior,
    } = req.body;

    const actual = await pool.query(`
      SELECT *
      FROM configuracion_factura
      ORDER BY id ASC
      LIMIT 1
    `);

    const logo_url = logoUrl(req, actual.rows[0]?.logo_url);

    let result;

    if (actual.rows.length === 0) {
      result = await pool.query(
        `
        INSERT INTO configuracion_factura (
          razon_social,
          nit,
          direccion,
          telefono,
          email,
          prefijo_factura,
          resolucion_dian,
          mensaje_inferior,
          logo_url
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        `,
        [
          razon_social,
          nit,
          direccion,
          telefono,
          email,
          prefijo_factura || "POS",
          resolucion_dian,
          mensaje_inferior,
          logo_url,
        ]
      );
    } else {
      result = await pool.query(
        `
        UPDATE configuracion_factura
        SET
          razon_social = $1,
          nit = $2,
          direccion = $3,
          telefono = $4,
          email = $5,
          prefijo_factura = $6,
          resolucion_dian = $7,
          mensaje_inferior = $8,
          logo_url = $9,
          actualizado_en = CURRENT_TIMESTAMP
        WHERE id = $10
        RETURNING *
        `,
        [
          razon_social,
          nit,
          direccion,
          telefono,
          email,
          prefijo_factura || "POS",
          resolucion_dian,
          mensaje_inferior,
          logo_url,
          actual.rows[0].id,
        ]
      );
    }

    res.json({
      ok: true,
      message: "Configuración actualizada",
      configuracion: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error actualizando configuración",
    });
  }
}
