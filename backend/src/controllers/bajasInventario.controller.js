import { pool } from "../config/db.js";
import { asegurarTablasOperaciones } from "../utils/operacionesSchema.js";

function fechaHoyBogota() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());
}

export async function listarBajasInventario(req, res) {
  try {
    await asegurarTablasOperaciones();

    const fecha = req.query.fecha || fechaHoyBogota();

    const [bajas, inventario] = await Promise.all([
      pool.query(
        `
        SELECT
          b.*,
          i.nombre AS inventario_nombre,
          um.abreviatura AS unidad_abreviatura,
          u.nombre AS usuario_nombre
        FROM bajas_inventario b
        INNER JOIN inventario i ON i.id = b.inventario_id
        LEFT JOIN unidades_medida um ON um.id = i.unidad_medida_id
        LEFT JOIN usuarios u ON u.id = b.usuario_id
        WHERE b.fecha = $1::date
        ORDER BY b.creado_en DESC
        `,
        [fecha],
      ),
      pool.query(
        `
        SELECT
          i.id,
          i.nombre,
          i.cantidad_actual,
          i.costo_unitario,
          um.abreviatura AS unidad_abreviatura
        FROM inventario i
        LEFT JOIN unidades_medida um ON um.id = i.unidad_medida_id
        WHERE i.activo = true
        ORDER BY i.nombre ASC
        `,
      ),
    ]);

    res.json({
      ok: true,
      fecha,
      bajas: bajas.rows,
      inventario: inventario.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error listando bajas" });
  }
}

export async function crearBajaInventario(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await asegurarTablasOperaciones(client);

    const {
      inventario_id,
      cantidad,
      descripcion,
      fecha = fechaHoyBogota(),
    } = req.body;

    const cantidadBaja = Number(cantidad || 0);

    if (!inventario_id || cantidadBaja <= 0 || !descripcion) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "Debes seleccionar producto, cantidad y descripcion",
      });
    }

    const inventario = await client.query(
      `
      SELECT *
      FROM inventario
      WHERE id = $1
      AND activo = true
      FOR UPDATE
      `,
      [inventario_id],
    );

    if (inventario.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, message: "Inventario no encontrado" });
    }

    const item = inventario.rows[0];
    const cantidadAnterior = Number(item.cantidad_actual || 0);
    const cantidadNueva = cantidadAnterior - cantidadBaja;
    const costoUnitario = Number(item.costo_unitario || 0);
    const costoTotal = costoUnitario * cantidadBaja;

    if (cantidadNueva < 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "La cantidad a dar de baja supera el stock actual",
      });
    }

    const baja = await client.query(
      `
      INSERT INTO bajas_inventario (
        inventario_id,
        usuario_id,
        cantidad,
        costo_unitario_momento,
        costo_total,
        descripcion,
        fecha,
        creado_en
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,timezone('America/Bogota', now()))
      RETURNING *
      `,
      [
        inventario_id,
        req.usuario.id,
        cantidadBaja,
        costoUnitario,
        costoTotal,
        descripcion,
        fecha,
      ],
    );

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
        inventario_id,
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
      VALUES ($1,$2,'AJUSTE',$3,$4,$5,'BAJA_INVENTARIO',$6,$7,timezone('America/Bogota', now()))
      `,
      [
        inventario_id,
        req.usuario.id,
        cantidadBaja * -1,
        cantidadAnterior,
        cantidadNueva,
        baja.rows[0].id,
        descripcion,
      ],
    );

    await client.query("COMMIT");

    res.status(201).json({ ok: true, baja: baja.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ ok: false, message: "Error registrando baja" });
  } finally {
    client.release();
  }
}

export async function actualizarBajaInventario(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await asegurarTablasOperaciones(client);

    const { id } = req.params;
    const {
      inventario_id,
      cantidad,
      descripcion,
      fecha = fechaHoyBogota(),
    } = req.body;

    const cantidadNuevaBaja = Number(cantidad || 0);

    if (!inventario_id || cantidadNuevaBaja <= 0 || !descripcion) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "Debes seleccionar producto, cantidad y descripcion",
      });
    }

    const bajaActual = await client.query(
      `
      SELECT *
      FROM bajas_inventario
      WHERE id = $1
      FOR UPDATE
      `,
      [id],
    );

    if (bajaActual.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, message: "Baja no encontrada" });
    }

    const baja = bajaActual.rows[0];
    const inventarioAnterior = await client.query(
      `
      SELECT *
      FROM inventario
      WHERE id = $1
      FOR UPDATE
      `,
      [baja.inventario_id],
    );

    const inventarioNuevo = await client.query(
      `
      SELECT *
      FROM inventario
      WHERE id = $1
      AND activo = true
      FOR UPDATE
      `,
      [inventario_id],
    );

    if (inventarioNuevo.rows.length === 0 || inventarioAnterior.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, message: "Inventario no encontrado" });
    }

    const itemAnterior = inventarioAnterior.rows[0];
    const itemNuevo = inventarioNuevo.rows[0];
    const cantidadBajaAnterior = Number(baja.cantidad || 0);
    const stockAnteriorAntes = Number(itemAnterior.cantidad_actual || 0);
    const stockAnteriorRevertido = stockAnteriorAntes + cantidadBajaAnterior;

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
        stockAnteriorRevertido,
        stockAnteriorRevertido <= Number(itemAnterior.stock_minimo || 0),
        baja.inventario_id,
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
      VALUES ($1,$2,'AJUSTE',$3,$4,$5,'BAJA_INVENTARIO_EDITADA',$6,$7,timezone('America/Bogota', now()))
      `,
      [
        baja.inventario_id,
        req.usuario.id,
        cantidadBajaAnterior,
        stockAnteriorAntes,
        stockAnteriorRevertido,
        baja.id,
        "Reversion por edicion de baja",
      ],
    );

    const stockNuevoAntes = Number(itemNuevo.id) === Number(itemAnterior.id)
      ? stockAnteriorRevertido
      : Number(itemNuevo.cantidad_actual || 0);
    const stockNuevoDespues = stockNuevoAntes - cantidadNuevaBaja;
    const costoUnitario = Number(itemNuevo.costo_unitario || 0);
    const costoTotal = costoUnitario * cantidadNuevaBaja;

    if (stockNuevoDespues < 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "La cantidad a dar de baja supera el stock actual",
      });
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
        stockNuevoDespues,
        stockNuevoDespues <= Number(itemNuevo.stock_minimo || 0),
        inventario_id,
      ],
    );

    const bajaActualizada = await client.query(
      `
      UPDATE bajas_inventario
      SET
        inventario_id = $1,
        cantidad = $2,
        costo_unitario_momento = $3,
        costo_total = $4,
        descripcion = $5,
        fecha = $6
      WHERE id = $7
      RETURNING *
      `,
      [
        inventario_id,
        cantidadNuevaBaja,
        costoUnitario,
        costoTotal,
        descripcion,
        fecha,
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
        referencia_tipo,
        referencia_id,
        motivo,
        creado_en
      )
      VALUES ($1,$2,'AJUSTE',$3,$4,$5,'BAJA_INVENTARIO',$6,$7,timezone('America/Bogota', now()))
      `,
      [
        inventario_id,
        req.usuario.id,
        cantidadNuevaBaja * -1,
        stockNuevoAntes,
        stockNuevoDespues,
        baja.id,
        descripcion,
      ],
    );

    await client.query("COMMIT");

    res.json({ ok: true, baja: bajaActualizada.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ ok: false, message: "Error actualizando baja" });
  } finally {
    client.release();
  }
}

export async function eliminarBajaInventario(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await asegurarTablasOperaciones(client);

    const { id } = req.params;
    const bajaActual = await client.query(
      `
      SELECT *
      FROM bajas_inventario
      WHERE id = $1
      FOR UPDATE
      `,
      [id],
    );

    if (bajaActual.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, message: "Baja no encontrada" });
    }

    const baja = bajaActual.rows[0];
    const inventario = await client.query(
      `
      SELECT *
      FROM inventario
      WHERE id = $1
      FOR UPDATE
      `,
      [baja.inventario_id],
    );

    if (inventario.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, message: "Inventario no encontrado" });
    }

    const item = inventario.rows[0];
    const cantidadAnterior = Number(item.cantidad_actual || 0);
    const cantidadNueva = cantidadAnterior + Number(baja.cantidad || 0);

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
        baja.inventario_id,
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
      VALUES ($1,$2,'AJUSTE',$3,$4,$5,'BAJA_INVENTARIO_ELIMINADA',$6,$7,timezone('America/Bogota', now()))
      `,
      [
        baja.inventario_id,
        req.usuario.id,
        Number(baja.cantidad || 0),
        cantidadAnterior,
        cantidadNueva,
        baja.id,
        "Reversion por eliminacion de baja",
      ],
    );

    await client.query(`DELETE FROM bajas_inventario WHERE id = $1`, [id]);
    await client.query("COMMIT");

    res.json({ ok: true, message: "Baja eliminada" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ ok: false, message: "Error eliminando baja" });
  } finally {
    client.release();
  }
}
