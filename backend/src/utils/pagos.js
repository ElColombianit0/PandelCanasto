import { readFile } from "node:fs/promises";
import { pool } from "../config/db.js";

let esquema;
export function asegurarEsquemaPagos() {
  if (!esquema) esquema = crearEsquema().catch((error) => { esquema = null; throw error; });
  return esquema;
}

async function crearEsquema() {
  const sql = await readFile(new URL("../../sql/20261006_pagos_mixtos.sql", import.meta.url), "utf8");
  const client = await pool.connect();
  try { await client.query(sql); }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

function invalido(message) { return Object.assign(new Error(message), { statusCode: 400 }); }

export function centavos(valor) {
  if (valor === "" || valor == null || !["string", "number"].includes(typeof valor)) throw invalido("Ingresa un monto valido.");
  const numero = Number(valor);
  const cents = Math.round(numero * 100);
  if (!Number.isFinite(numero) || numero < 0 || !Number.isSafeInteger(cents) || cents > 999999999999 || Math.abs(numero * 100 - cents) > 0.00001) {
    throw invalido("Los montos deben ser positivos y tener como maximo dos decimales.");
  }
  return cents;
}

export async function prepararPago(client, { metodo, desglose, recibido, total }) {
  const totalCents = centavos(total);
  const mixto = metodo === "MIXTO";
  let partes = mixto ? desglose : [{ metodo_pago_id: metodo, monto: total }];
  if (!Array.isArray(partes) || partes.length < (mixto ? 2 : 1) || partes.length > 3) throw invalido("El pago mixto necesita al menos dos medios de pago.");
  const ids = new Set();
  partes = partes.map((parte) => {
    if (!parte || typeof parte !== "object" || Array.isArray(parte)) throw invalido("Revisa el desglose del pago.");
    const id = Number(parte.metodo_pago_id);
    const monto = centavos(parte.monto);
    if (!Number.isSafeInteger(id) || id <= 0 || ids.has(id) || (monto <= 0 && (mixto || totalCents !== 0))) throw invalido("Revisa los medios y montos del pago.");
    ids.add(id);
    return { metodo_pago_id: id, monto: monto / 100, cents: monto };
  });
  if (partes.reduce((suma, parte) => suma + parte.cents, 0) !== totalCents) throw invalido("La suma de los pagos debe coincidir exactamente con el total de la venta.");
  const metodos = await client.query("SELECT id, nombre FROM metodos_pago WHERE id = ANY($1::int[]) AND activo = true", [[...ids]]);
  for (const parte of partes) {
    const encontrado = metodos.rows.find((item) => Number(item.id) === parte.metodo_pago_id);
    if (!encontrado || !/efectivo|tarjeta|transfer/i.test(encontrado.nombre)) throw invalido("Medio de pago no disponible.");
    parte.metodo_pago = encontrado.nombre;
  }
  const efectivo = partes.filter((p) => /efectivo/i.test(p.metodo_pago)).reduce((s, p) => s + p.cents, 0);
  const recibidoCents = efectivo ? centavos(recibido) : 0;
  if (recibidoCents < efectivo) throw invalido("El efectivo recibido no puede ser menor a la parte pagada en efectivo.");
  const mixtoRes = mixto ? await client.query("SELECT id FROM metodos_pago WHERE lower(trim(nombre)) = 'mixto' AND activo = true ORDER BY id LIMIT 1") : null;
  if (mixto && !mixtoRes.rows.length) throw new Error("No esta configurado el metodo de pago mixto.");
  return {
    metodo_pago_id: mixto ? mixtoRes.rows[0].id : partes[0].metodo_pago_id,
    desglose: partes.filter((p) => p.cents > 0).map(({ cents, ...parte }) => parte),
    monto_recibido: (recibidoCents + totalCents - efectivo) / 100,
    efectivo_recibido: recibidoCents / 100,
    cambio: (recibidoCents - efectivo) / 100,
  };
}

export async function guardarDesglose(client, pagoId, partes) {
  await client.query("DELETE FROM pagos_desglose WHERE pago_id = $1", [pagoId]);
  for (const parte of partes) await client.query("INSERT INTO pagos_desglose (pago_id, metodo_pago_id, monto) VALUES ($1,$2,$3)", [pagoId, parte.metodo_pago_id, parte.monto]);
}

export const desgloseVentaSQL = `(SELECT COALESCE(json_agg(json_build_object('metodo_pago_id', vp.metodo_pago_id, 'metodo_pago', vp.metodo_pago, 'monto', vp.monto) ORDER BY vp.metodo_pago_id), '[]'::json) FROM ventas_pagos_desglose vp WHERE vp.venta_id = v.id)`;
