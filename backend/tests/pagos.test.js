import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pool } from "../src/config/db.js";
import { cobrarPedido } from "../src/controllers/pedidos.controller.js";
import { actualizarDetalleVenta, anularVenta, listarVentas, obtenerVenta } from "../src/controllers/ventas.controller.js";
import { obtenerCierreCaja } from "../src/controllers/caja.controller.js";
import { resumenDashboard } from "../src/controllers/reportes.controller.js";
import { resumenUtilidad } from "../src/controllers/configuracionAdmin.controller.js";
import { prepararPago, centavos } from "../src/utils/pagos.js";

const db = new PGlite();
const originales = { query: pool.query, connect: pool.connect };
const query = async (sql, params) => params ? db.query(sql, params) : (await db.exec(sql)).at(-1) || { rows: [] };
const client = { query, release() {} };
async function llamar(handler, { body = {}, id, filtros = {} } = {}) {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
  await handler({ body, params: { id }, query: filtros, usuario: { id: 1, rol: "ADMIN" } }, res);
  return res;
}
async function pedido({ producto = 1, cantidad = 2, precio = 10000, propina = 0, mesa = null } = {}) {
  const { rows: [p] } = await db.query("INSERT INTO pedidos (estado, propina_porcentaje, mesa_id) VALUES ('ABIERTO',$1,$2) RETURNING *", [propina, mesa]);
  await db.query("INSERT INTO detalle_pedidos (pedido_id,producto_id,cantidad,precio_unitario,subtotal) VALUES ($1,$2,$3,$4,$5)", [p.id, producto, cantidad, precio, cantidad * precio]);
  return p.id;
}
const porMetodo = (rows) => Object.fromEntries(rows.map((p) => [p.metodo_pago, Number(p.total)]));
const partes = (efectivo, transferencia, tarjeta = 0) => [{ metodo_pago_id: 1, monto: efectivo }, { metodo_pago_id: 3, monto: transferencia }, { metodo_pago_id: 2, monto: tarjeta }].filter((p) => p.monto > 0);

before(async () => {
  pool.query = query; pool.connect = async () => client;
  await db.exec(`
    SET timezone = 'America/Bogota';
    CREATE TABLE sucursales (id integer PRIMARY KEY, nombre text, activo boolean DEFAULT true);
    INSERT INTO sucursales VALUES (1,'Principal',true);
    CREATE TABLE usuarios (id integer PRIMARY KEY, nombre text, rol text, activo boolean DEFAULT true, sucursal_id integer);
    INSERT INTO usuarios VALUES (1,'Admin','ADMIN',true,1);
    CREATE TABLE mesas (id integer PRIMARY KEY, estado text, activo boolean DEFAULT true);
    INSERT INTO mesas VALUES (1,'OCUPADA',true);
    CREATE TABLE metodos_pago (id serial PRIMARY KEY, nombre text, activo boolean DEFAULT true);
    INSERT INTO metodos_pago (nombre) VALUES ('Efectivo'),('Tarjeta'),('Transferencia');
    CREATE TABLE pedidos (id serial PRIMARY KEY, estado text, mesa_id integer, propina_porcentaje numeric DEFAULT 0, subtotal numeric, propina numeric, propina_valor numeric, total numeric, cerrado_en timestamp);
    CREATE TABLE productos (id integer PRIMARY KEY, nombre text, imagen_url text, es_promocion boolean DEFAULT false, producto_base_id integer, cantidad_base numeric DEFAULT 1);
    INSERT INTO productos (id,nombre) VALUES (1,'Pan'),(2,'Milo'),(3,'Combo');
    CREATE TABLE detalle_pedidos (id serial PRIMARY KEY, pedido_id integer, producto_id integer, cantidad numeric, precio_unitario numeric, descuento_porcentaje numeric DEFAULT 0, subtotal numeric);
    CREATE TABLE pagos (id serial PRIMARY KEY, pedido_id integer, metodo_pago_id integer, usuario_id integer, subtotal numeric(12,2), propina numeric(12,2), propina_porcentaje numeric, propina_valor numeric(12,2), total_pagado numeric(12,2), monto_recibido numeric(12,2), cambio numeric(12,2), estado text, creado_en timestamp);
    CREATE TABLE ventas (id serial PRIMARY KEY, pedido_id integer, pago_id integer, usuario_id integer, subtotal numeric(12,2), propina numeric(12,2), propina_porcentaje numeric, propina_valor numeric(12,2), total numeric(12,2), sucursal_id integer, fecha_venta timestamp, estado text);
    CREATE TABLE facturas (id serial PRIMARY KEY, venta_id integer, usuario_id integer, numero_factura text, tipo_factura text, estado text, sucursal_id integer, emitida_en timestamp, cliente_nombre text, cliente_documento text, cliente_email text);
    CREATE TABLE configuracion_factura (id integer);
    CREATE TABLE recetas (id integer PRIMARY KEY, producto_id integer, auto_preparar boolean DEFAULT false, activo boolean DEFAULT true);
    INSERT INTO recetas VALUES (1,2,true,true);
    CREATE TABLE inventario (id integer PRIMARY KEY, producto_venta_id integer, nombre text, cantidad_actual numeric, stock_minimo numeric DEFAULT 0, descontar_en_venta boolean DEFAULT true, activo boolean DEFAULT true, alerta_activa boolean DEFAULT false, actualizado_en timestamp);
    INSERT INTO inventario (id,producto_venta_id,nombre,cantidad_actual) VALUES (1,1,'Pan',100),(2,NULL,'Azucar',1000),(3,2,'Milo',0);
    CREATE TABLE receta_ingredientes (id serial PRIMARY KEY, receta_id integer, inventario_id integer, cantidad_usada numeric, activo boolean DEFAULT true);
    INSERT INTO receta_ingredientes (receta_id,inventario_id,cantidad_usada) VALUES (1,2,100);
    CREATE TABLE producto_componentes (id serial PRIMARY KEY, producto_id integer REFERENCES productos(id), componente_producto_id integer REFERENCES productos(id), cantidad numeric, creado_en timestamp);
    INSERT INTO producto_componentes (producto_id,componente_producto_id,cantidad) VALUES (3,1,5);
    CREATE TABLE movimientos_inventario (id serial PRIMARY KEY, inventario_id integer, usuario_id integer, tipo_movimiento text, cantidad numeric, cantidad_anterior numeric, cantidad_nueva numeric, referencia_tipo text, referencia_id integer, motivo text, creado_en timestamp);
    CREATE TABLE auditoria_ventas (id serial PRIMARY KEY, venta_id integer, admin_id integer, accion text, motivo text, total_anterior numeric, total_nuevo numeric);
    CREATE TABLE gastos_operativos (monto numeric, tipo text, activo boolean, periodo_mes date, recurrente boolean);
    CREATE TABLE horas_extra_empleados (total numeric, fecha date);
  `);
  const sql = await readFile(new URL("../sql/20261006_pagos_mixtos.sql", import.meta.url), "utf8");
  await db.exec(sql); await db.exec(sql);
});
after(async () => { pool.query = originales.query; pool.connect = originales.connect; await db.close(); });

test("validacion monetaria exacta y medios de pago", async () => {
  assert.equal(centavos("10000.25"), 1000025);
  for (const monto of [null, "", NaN, Infinity, -1, "1.001", {}, true]) assert.throws(() => centavos(monto));
  for (const desglose of [partes(10000, 9999.99), partes(10000, 10000.01), [{ metodo_pago_id: 1, monto: 10000 }, { metodo_pago_id: 1, monto: 10000 }], [{ metodo_pago_id: 999, monto: 10000 }, { metodo_pago_id: 3, monto: 10000 }]]) {
    await assert.rejects(prepararPago(client, { metodo: "MIXTO", desglose, recibido: 10000, total: 20000 }), { statusCode: 400 });
  }
  await assert.rejects(prepararPago(client, { metodo: "MIXTO", desglose: partes(10000, 10000), recibido: 9999, total: 20000 }), { statusCode: 400 });
  assert.equal((await prepararPago(client, { metodo: 3, total: 20000 })).cambio, 0);
  assert.deepEqual((await prepararPago(client, { metodo: 3, total: 0 })).desglose, []);
  const triple = await prepararPago(client, { metodo: "MIXTO", desglose: partes(1000, 1200, 1800), recibido: 1200, total: 4000 });
  assert.equal(triple.desglose.length, 3);
  assert.equal(triple.cambio, 200);
  await assert.rejects(prepararPago(client, { metodo: "MIXTO", desglose: [null, { metodo_pago_id: 3, monto: 20000 }], total: 20000 }), { statusCode: 400 });
  await db.exec("UPDATE metodos_pago SET activo=false WHERE id=2");
  await assert.rejects(prepararPago(client, { metodo: 2, total: 20000 }), { statusCode: 400 });
  await db.exec("UPDATE metodos_pago SET activo=true WHERE id=2");
});

test("cobro mixto, reportes, correccion y anulacion conservan inventario y saldos", async (t) => {
  let ventaId, pedidoId;
  await t.test("cobro 10000 efectivo + 10000 transferencia, cambio solo de efectivo y mesa libre", async () => {
    pedidoId = await pedido({ mesa: 1 });
    const res = await llamar(cobrarPedido, { body: { pedido_id: pedidoId, metodo_pago_id: "MIXTO", monto_recibido: 15000, pagos_desglose: partes(10000, 10000) } });
    assert.equal(res.statusCode, 200, JSON.stringify(res.data));
    ventaId = res.data.venta.id;
    assert.equal(Number(res.data.pago.monto_recibido), 25000);
    assert.equal(Number(res.data.pago.cambio), 5000);
    assert.equal(res.data.pago.efectivo_recibido, 15000);
    assert.equal(res.data.pago.pagos_desglose.length, 2);
    assert.equal((await db.query("SELECT estado FROM mesas WHERE id=1")).rows[0].estado, "LIBRE");
    assert.equal(Number((await db.query("SELECT cantidad_actual FROM inventario WHERE id=1")).rows[0].cantidad_actual), 98);
    const repetido = await llamar(cobrarPedido, { body: { pedido_id: pedidoId, metodo_pago_id: 1, monto_recibido: 20000 } });
    assert.equal(repetido.statusCode, 404);
    assert.equal((await db.query("SELECT * FROM ventas")).rows.length, 1);
  });
  await t.test("rechaza suma incorrecta sin cobrar ni modificar stock", async () => {
    const id = await pedido();
    const res = await llamar(cobrarPedido, { body: { pedido_id: id, metodo_pago_id: "MIXTO", monto_recibido: 10000, pagos_desglose: partes(10000, 9999) } });
    assert.equal(res.statusCode, 400);
    assert.equal((await db.query("SELECT estado FROM pedidos WHERE id=$1", [id])).rows[0].estado, "ABIERTO");
    assert.equal((await db.query("SELECT * FROM pagos")).rows.length, 1);
    assert.equal(Number((await db.query("SELECT cantidad_actual FROM inventario WHERE id=1")).rows[0].cantidad_actual), 98);
  });
  await t.test("caja, dashboard y administrar ventas usan el desglose sin duplicar total", async () => {
    const dia = (await db.query("SELECT timezone('America/Bogota',now())::date::text AS dia")).rows[0].dia;
    const caja = await llamar(obtenerCierreCaja, { filtros: { fecha: dia } });
    const dashboard = await llamar(resumenDashboard);
    const listado = await llamar(listarVentas);
    for (const res of [caja, dashboard, listado]) assert.equal(res.statusCode, 200, JSON.stringify(res.data));
    assert.deepEqual(porMetodo(caja.data.ventas), { Efectivo: 10000, Transferencia: 10000 });
    assert.deepEqual(porMetodo(dashboard.data.ventas_por_metodo_pago), { Efectivo: 10000, Transferencia: 10000 });
    assert.deepEqual(porMetodo(listado.data.resumen.metodos_pago), { Efectivo: 10000, Transferencia: 10000 });
    assert.equal(dashboard.data.resumen.total_ventas, 20000);
    assert.equal(listado.data.resumen.cantidad_validas, 1);
    const detalle = await llamar(obtenerVenta, { id: ventaId });
    assert.equal(detalle.data.venta.pagos_desglose.length, 2);
  });
  await t.test("corregir el total exige actualizar el reparto y un error revierte todo", async () => {
    const detalle = (await db.query("SELECT * FROM detalle_pedidos WHERE pedido_id=$1", [pedidoId])).rows[0];
    const body = { motivo: "Solo un pan", detalles: [{ ...detalle, cantidad: 1 }] };
    assert.equal((await llamar(actualizarDetalleVenta, { id: ventaId, body })).statusCode, 400);
    assert.equal(Number((await db.query("SELECT cantidad_actual FROM inventario WHERE id=1")).rows[0].cantidad_actual), 98);
    const res = await llamar(actualizarDetalleVenta, { id: ventaId, body: { ...body, pagos_desglose: partes(5000, 5000) } });
    assert.equal(res.statusCode, 200, JSON.stringify(res.data));
    assert.equal(Number((await db.query("SELECT cantidad_actual FROM inventario WHERE id=1")).rows[0].cantidad_actual), 99);
    assert.deepEqual(porMetodo((await llamar(listarVentas)).data.resumen.metodos_pago), { Efectivo: 5000, Transferencia: 5000 });
  });
  await t.test("anular retira ambos medios y devuelve stock una sola vez", async () => {
    assert.equal((await llamar(anularVenta, { id: ventaId, body: { motivo: "Prueba" } })).statusCode, 200);
    assert.equal((await llamar(anularVenta, { id: ventaId, body: { motivo: "Repetido" } })).statusCode, 404);
    assert.equal(Number((await db.query("SELECT cantidad_actual FROM inventario WHERE id=1")).rows[0].cantidad_actual), 100);
    assert.deepEqual((await llamar(listarVentas)).data.resumen.metodos_pago, []);
  });
  await t.test("mixto tarjeta + transferencia sin pedir efectivo; comision solo sobre tarjeta", async () => {
    const id = await pedido({ propina: 10 });
    const res = await llamar(cobrarPedido, { body: { pedido_id: id, metodo_pago_id: "MIXTO", pagos_desglose: partes(0, 10000, 12000) } });
    assert.equal(res.statusCode, 200, JSON.stringify(res.data));
    assert.equal(Number(res.data.pago.cambio), 0);
    const mes = (await db.query("SELECT to_char(timezone('America/Bogota',now()),'YYYY-MM') AS mes")).rows[0].mes;
    const utilidad = await llamar(resumenUtilidad, { filtros: { mes } });
    assert.equal(utilidad.statusCode, 200, JSON.stringify(utilidad.data));
    assert.equal(utilidad.data.resumen.comision_datafono, 586.8);
  });
  await t.test("las recetas auto preparadas y combos conservan sus descuentos y devoluciones", async () => {
    for (const producto of [2, 3]) {
      const id = await pedido({ producto, cantidad: 1, precio: 20000 });
      const res = await llamar(cobrarPedido, { body: { pedido_id: id, metodo_pago_id: "MIXTO", monto_recibido: 10000, pagos_desglose: partes(10000, 10000) } });
      assert.equal(res.statusCode, 200, JSON.stringify(res.data));
      if (producto === 2) {
        assert.equal(Number((await db.query("SELECT cantidad_actual FROM inventario WHERE id=2")).rows[0].cantidad_actual), 900);
        assert.equal(Number((await db.query("SELECT cantidad_actual FROM inventario WHERE id=3")).rows[0].cantidad_actual), 0);
      }
      assert.equal((await llamar(anularVenta, { id: res.data.venta.id, body: { motivo: "Prueba inventario" } })).statusCode, 200);
    }
    assert.equal(Number((await db.query("SELECT cantidad_actual FROM inventario WHERE id=2")).rows[0].cantidad_actual), 1000);
    assert.equal(Number((await db.query("SELECT cantidad_actual FROM inventario WHERE id=1")).rows[0].cantidad_actual), 98);
  });
  await t.test("ventas antiguas sin desglose y nuevas simples siguen funcionando", async () => {
    const id = await pedido({ cantidad: 1 });
    const res = await llamar(cobrarPedido, { body: { pedido_id: id, metodo_pago_id: 3 } });
    assert.equal(res.statusCode, 200, JSON.stringify(res.data));
    await db.query("DELETE FROM pagos_desglose WHERE pago_id=$1", [res.data.pago.id]);
    assert.deepEqual(porMetodo((await llamar(listarVentas)).data.resumen.metodos_pago), { Tarjeta: 12000, Transferencia: 20000 });
  });
  await t.test("un fallo de inventario revierte tambien el pago y su desglose", async () => {
    const antes = (await db.query("SELECT (SELECT count(*) FROM pagos) AS pagos, (SELECT count(*) FROM pagos_desglose) AS partes, (SELECT count(*) FROM ventas) AS ventas")).rows[0];
    const id = await pedido({ producto: 2, cantidad: 11, precio: 20000 });
    const res = await llamar(cobrarPedido, { body: { pedido_id: id, metodo_pago_id: "MIXTO", monto_recibido: 110000, pagos_desglose: partes(110000, 110000) } });
    assert.equal(res.statusCode, 400);
    assert.match(res.data.message, /Stock insuficiente/);
    assert.deepEqual((await db.query("SELECT (SELECT count(*) FROM pagos) AS pagos, (SELECT count(*) FROM pagos_desglose) AS partes, (SELECT count(*) FROM ventas) AS ventas")).rows[0], antes);
    assert.equal(Number((await db.query("SELECT cantidad_actual FROM inventario WHERE id=2")).rows[0].cantidad_actual), 1000);
    assert.equal((await db.query("SELECT estado FROM pedidos WHERE id=$1", [id])).rows[0].estado, "ABIERTO");
  });
  await t.test("efectivo simple exige recibido y conserva el cambio tras corregir productos", async () => {
    const id = await pedido();
    assert.equal((await llamar(cobrarPedido, { body: { pedido_id: id, metodo_pago_id: 1 } })).statusCode, 400);
    const res = await llamar(cobrarPedido, { body: { pedido_id: id, metodo_pago_id: 1, monto_recibido: 25000 } });
    assert.equal(res.statusCode, 200);
    assert.equal(Number(res.data.pago.cambio), 5000);
    const detalle = (await db.query("SELECT * FROM detalle_pedidos WHERE pedido_id=$1", [id])).rows[0];
    const corregida = await llamar(actualizarDetalleVenta, { id: res.data.venta.id, body: { motivo: "Cantidad real", detalles: [{ ...detalle, cantidad: 1 }] } });
    assert.equal(corregida.statusCode, 200);
    const { rows: [p] } = await db.query("SELECT * FROM pagos WHERE id=$1", [res.data.pago.id]);
    assert.equal(Number(p.cambio), 15000);
    assert.equal(Number((await db.query("SELECT monto FROM pagos_desglose WHERE pago_id=$1", [p.id])).rows[0].monto), 10000);
    await llamar(anularVenta, { id: res.data.venta.id, body: { motivo: "Prueba final" } });
  });
});
