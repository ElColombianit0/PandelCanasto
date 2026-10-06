import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../src/config/db.js";
import cajaRoutes from "../src/routes/caja.routes.js";
import * as caja from "../src/controllers/caja.controller.js";
import { resumenUtilidad } from "../src/controllers/configuracionAdmin.controller.js";
import { asegurarTablasOperaciones } from "../src/utils/operacionesSchema.js";

const db = new PGlite();
const queryOriginal = pool.query;
const connectOriginal = pool.connect;
const secretOriginal = process.env.JWT_SECRET;
let server;
let etiquetaPaola;

async function query(sql, params) {
  if (params) return db.query(sql, params);
  const results = await db.exec(sql);
  return results.at(-1) || { rows: [] };
}

async function llamar(handler, { body = {}, query: filtros = {}, id } = {}) {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; },
  };
  await handler({ body, query: filtros, params: { id }, usuario: { id: 1, rol: "ADMIN" } }, res);
  return res;
}

before(async () => {
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  await db.exec(`
    SET timezone = 'America/Bogota';
    CREATE TABLE usuarios (id integer PRIMARY KEY, nombre text, rol text, activo boolean);
    INSERT INTO usuarios VALUES (1, 'Admin', 'ADMIN', true);
    CREATE TABLE inventario (id integer PRIMARY KEY, cantidad_actual numeric);
    INSERT INTO inventario VALUES (1, 20);
    CREATE TABLE metodos_pago (id serial PRIMARY KEY, nombre text, activo boolean DEFAULT true);
    INSERT INTO metodos_pago (nombre) VALUES ('Efectivo');
    CREATE TABLE pagos (id integer PRIMARY KEY, metodo_pago_id integer);
    INSERT INTO pagos VALUES (1, 1);
    CREATE TABLE productos (id integer PRIMARY KEY, nombre text);
    INSERT INTO productos VALUES (1, 'Pan leche');
    CREATE TABLE pedidos (id integer PRIMARY KEY);
    INSERT INTO pedidos VALUES (1);
    CREATE TABLE detalle_pedidos (pedido_id integer, producto_id integer, cantidad numeric, subtotal numeric);
    INSERT INTO detalle_pedidos VALUES (1, 1, 200, 100000);
    CREATE TABLE ventas (id integer PRIMARY KEY, pago_id integer, pedido_id integer, total numeric, estado text, fecha_venta timestamp);
    INSERT INTO ventas VALUES (1, 1, 1, 100000, 'VALIDA', '2026-10-06 12:00:00');
    CREATE TABLE gastos_operativos (monto numeric, tipo text, activo boolean, periodo_mes date, recurrente boolean);
    CREATE TABLE horas_extra_empleados (total numeric, fecha date);
  `);
  await db.exec(await readFile(new URL("../sql/20261006_pagos_mixtos.sql", import.meta.url), "utf8"));
  await asegurarTablasOperaciones();
  await db.exec("INSERT INTO caja_gastos (fecha, descripcion, monto, usuario_id) VALUES ('2026-10-06', 'Gasto anterior', 1000, 1)");
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  pool.query = queryOriginal;
  pool.connect = connectOriginal;
  if (secretOriginal == null) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = secretOriginal;
  await db.close();
});

test("etiquetas y caja general conservan el cierre diario", async (t) => {
  await t.test("la migracion es idempotente y conserva gastos anteriores", async () => {
    const results = await Promise.all([
      llamar(caja.obtenerEtiquetasCaja), llamar(caja.obtenerHistorialGeneral),
    ]);
    assert.ok(results.every((result) => result.statusCode === 200));
    const sql = await readFile(new URL("../sql/20261006_caja_etiquetas_general.sql", import.meta.url), "utf8");
    await db.exec(sql);
    await db.exec(sql);
    const { rows } = await db.query("SELECT * FROM caja_gastos WHERE descripcion = 'Gasto anterior'");
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].monto), 1000);
    assert.equal(rows[0].etiqueta_id, null);
    assert.equal(rows[0].comentario, "");
    assert.equal(rows[0].reintegrado, false);
    await db.exec("DELETE FROM caja_gastos");
  });

  await t.test("las etiquetas se reutilizan y no se duplican por mayusculas o espacios", async () => {
    const creada = await llamar(caja.crearEtiquetaCaja, { body: { nombre: " Paola " } });
    assert.equal(creada.statusCode, 201);
    etiquetaPaola = creada.data.etiqueta.id;
    assert.equal(creada.data.etiqueta.nombre, "Paola");
    const duplicada = await llamar(caja.crearEtiquetaCaja, { body: { nombre: "paola" } });
    assert.equal(duplicada.statusCode, 409);
    assert.equal((await llamar(caja.obtenerEtiquetasCaja)).data.etiquetas.length, 1);
  });

  await t.test("el filtro mensual y por etiqueta respeta ambos limites del mes", async () => {
    for (const [fecha, monto, etiqueta_id, reintegrado] of [
      ["2026-09-30", 999, etiquetaPaola, false],
      ["2026-10-01", 50000, etiquetaPaola, false],
      ["2026-10-31", 10000.25, etiquetaPaola, true],
      ["2026-11-01", 999, etiquetaPaola, false],
      ["2026-10-06", 1200, null, false],
    ]) {
      const response = await llamar(caja.crearGastoCaja, { body: {
        fecha, descripcion: "Compra", monto, etiqueta_id, reintegrado, comentario: reintegrado ? "Ya lo pago" : "",
      } });
      assert.equal(response.statusCode, 201);
      assert.equal(response.data.gasto.fecha, fecha);
    }
    const historial = await llamar(caja.obtenerHistorialGastos, { query: { mes: "2026-10", etiqueta_id: etiquetaPaola } });
    assert.equal(historial.statusCode, 200);
    assert.deepEqual(historial.data.gastos.map((item) => item.fecha), ["2026-10-31", "2026-10-01"]);
    assert.deepEqual(historial.data.resumen, { cantidad: 2, total: 60000.25, reintegrado: 10000.25, pendiente: 50000 });
    const pendiente = await llamar(caja.obtenerHistorialGastos, {
      query: { mes: "2026-10", etiqueta_id: etiquetaPaola, estado: "PENDIENTE" },
    });
    assert.equal(pendiente.data.gastos.length, 1);
    assert.equal(pendiente.data.resumen.total, 50000);
  });

  await t.test("editar un gasto conserva los metadatos si un cliente anterior no los envia", async () => {
    const { rows: [original] } = await db.query("SELECT * FROM caja_gastos WHERE fecha = '2026-10-31'");
    const response = await llamar(caja.actualizarGastoCaja, { id: original.id, body: {
      fecha: "2026-10-31", descripcion: "Compra corregida", monto: 15000, metodo_salida: "TRANSFERENCIA",
    } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.data.gasto.etiqueta_id, etiquetaPaola);
    assert.equal(response.data.gasto.comentario, "Ya lo pago");
    assert.equal(response.data.gasto.reintegrado, true);
    const borrarMetadatos = await llamar(caja.actualizarGastoCaja, { id: original.id, body: {
      fecha: "2026-10-31", descripcion: "Compra corregida", monto: 15000,
      etiqueta_id: "", comentario: "", reintegrado: false,
    } });
    assert.equal(borrarMetadatos.statusCode, 200);
    assert.equal(borrarMetadatos.data.gasto.etiqueta_id, null);
    assert.equal(borrarMetadatos.data.gasto.comentario, "");
    assert.equal(borrarMetadatos.data.gasto.reintegrado, false);
  });

  await t.test("los comentarios y el reintegro no alteran los gastos del cierre original", async () => {
    const antes = await llamar(caja.obtenerCierreCaja, { query: { fecha: "2026-10-06" } });
    const item = antes.data.gastos[0];
    const response = await llamar(caja.actualizarGastoCaja, { id: item.id, body: {
      fecha: item.fecha, descripcion: item.descripcion, monto: item.monto, metodo_salida: item.metodo_salida,
      etiqueta_id: etiquetaPaola, comentario: "Ya lo pago", reintegrado: true,
    } });
    assert.equal(response.statusCode, 200);
    const despues = await llamar(caja.obtenerCierreCaja, { query: { fecha: "2026-10-06" } });
    assert.deepEqual(despues.data.gastos_resumen, antes.data.gastos_resumen);
    assert.equal(despues.data.gastos[0].etiqueta_nombre, "Paola");
    assert.equal(despues.data.gastos[0].fecha, "2026-10-06");
  });

  await t.test("crear, editar y eliminar de caja general no cambia cierres, utilidades ni inventario", async () => {
    const cierreAntes = await llamar(caja.obtenerCierreCaja, { query: { fecha: "2026-10-06" } });
    const utilidadAntes = await llamar(resumenUtilidad, { query: { mes: "2026-10" } });
    assert.equal(utilidadAntes.statusCode, 200);
    const body = { fecha: "2026-10-06", descripcion: "Caja general", monto: 50000, etiqueta_id: etiquetaPaola, comentario: "Compra del mes" };
    const creado = await llamar(caja.crearGastoGeneral, { body });
    assert.equal(creado.statusCode, 201);
    const listado = await llamar(caja.obtenerHistorialGeneral, { query: { mes: "2026-10", etiqueta_id: etiquetaPaola } });
    assert.equal(listado.data.resumen.total, 50000);
    const comparar = async () => {
      const cierre = await llamar(caja.obtenerCierreCaja, { query: { fecha: "2026-10-06" } });
      const utilidad = await llamar(resumenUtilidad, { query: { mes: "2026-10" } });
      assert.deepEqual(cierre.data, cierreAntes.data);
      assert.deepEqual(utilidad.data, utilidadAntes.data);
      const { rows } = await db.query("SELECT cantidad_actual FROM inventario WHERE id = 1");
      assert.equal(Number(rows[0].cantidad_actual), 20);
    };
    await comparar();
    const actualizado = await llamar(caja.actualizarGastoGeneral, { id: creado.data.gasto.id, body: { ...body, monto: 75000 } });
    assert.equal(actualizado.statusCode, 200);
    await comparar();
    assert.equal((await llamar(caja.eliminarGastoGeneral, { id: creado.data.gasto.id })).statusCode, 200);
    await comparar();
    assert.equal((await llamar(caja.obtenerHistorialGeneral, { query: { mes: "2026-10" } })).data.resumen.total, 0);
  });

  await t.test("se rechazan fechas, montos, estados y etiquetas invalidos", async () => {
    for (const cambio of [
      { fecha: "2026-02-30" }, { monto: "abc" }, { monto: 0 }, { monto: Infinity },
      { monto: 1e12 }, { metodo_salida: "OTRO" }, { etiqueta_id: "1 OR 1=1" }, { reintegrado: "false" },
      { monto: true }, { monto: [100] },
    ]) {
      const response = await llamar(caja.crearGastoCaja, { body: {
        fecha: "2026-10-06", descripcion: "Compra", monto: 1000, ...cambio,
      } });
      assert.equal(response.statusCode, 400);
    }
    for (const filtros of [{ mes: "2026-13" }, { mes: "2026-10", estado: "OTRO" }, { etiqueta_id: "abc" }]) {
      assert.equal((await llamar(caja.obtenerHistorialGastos, { query: filtros })).statusCode, 400);
    }
    assert.equal((await llamar(caja.eliminarGastoGeneral, { id: 99999 })).statusCode, 404);
  });

  await t.test("los nuevos endpoints solo permiten administradores", async () => {
    process.env.JWT_SECRET = "solo-para-pruebas-locales";
    const app = express();
    app.use(express.json());
    app.use("/api/caja", cajaRoutes);
    server = await new Promise((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const base = `http://127.0.0.1:${server.address().port}/api/caja`;
    const empleado = jwt.sign({ id: 1, rol: "EMPLEADO" }, process.env.JWT_SECRET);
    const admin = jwt.sign({ id: 1, rol: "ADMIN" }, process.env.JWT_SECRET);
    for (const [method, path] of [
      ["GET", "/etiquetas"], ["POST", "/etiquetas"], ["GET", "/gastos/historial"],
      ["GET", "/general"], ["POST", "/general"], ["PUT", "/general/1"], ["DELETE", "/general/1"],
    ]) {
      assert.equal((await fetch(`${base}${path}`, { method })).status, 401);
      assert.equal((await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${empleado}` } })).status, 403);
    }
    assert.equal((await fetch(`${base}/general?mes=2026-10`, { headers: { Authorization: `Bearer ${admin}` } })).status, 200);
  });

  await t.test("las bajas de inventario conservan su transaccion", async () => {
    await db.exec("BEGIN");
    await asegurarTablasOperaciones({ query });
    await db.query("UPDATE inventario SET cantidad_actual = 5 WHERE id = 1");
    await db.exec("ROLLBACK");
    const { rows } = await db.query("SELECT cantidad_actual FROM inventario WHERE id = 1");
    assert.equal(Number(rows[0].cantidad_actual), 20);
  });
});
