import "../styles/pagos.css";

export const mediosPago = [{ id: "1", nombre: "Efectivo" }, { id: "2", nombre: "Tarjeta" }, { id: "3", nombre: "Transferencia" }];
export const cantidadesPago = () => ({ "1": "", "2": "", "3": "" });
export const partesPago = (montos) => mediosPago.filter((m) => Number(montos[m.id]) > 0)
  .map((m) => ({ metodo_pago_id: Number(m.id), monto: Number(montos[m.id]) }));
export const montosValidos = (montos) => Object.values(montos).every((valor) => {
  const monto = Number(valor || 0);
  return Number.isFinite(monto) && monto >= 0 && Math.abs(monto * 100 - Math.round(monto * 100)) < 0.00001;
});

export default function PagoMixto({ montos, onChange, total }) {
  const asignado = mediosPago.reduce((s, m) => s + Math.round(Number(montos[m.id] || 0) * 100), 0);
  const saldo = (Math.round(total * 100) - asignado) / 100;
  return <div className="mixed-payment-fields">
    {mediosPago.map((medio) => <label key={medio.id}>{medio.nombre}
      <div className="money-input"><span aria-hidden="true">$</span><input type="number" min="0" step="0.01"
        aria-label={`Parte en ${medio.nombre.toLowerCase()}`} placeholder="0" value={montos[medio.id]}
        onChange={(e) => onChange({ ...montos, [medio.id]: e.target.value })} /></div>
    </label>)}
    <div className={`mixed-payment-balance ${saldo === 0 ? "balanced" : ""}`} role="status">
      <span>{saldo < 0 ? "Excede el total" : saldo > 0 ? "Por asignar" : "Total asignado"}</span>
      <strong>${Math.abs(saldo === 0 ? total : saldo).toLocaleString("es-CO")}</strong>
    </div>
  </div>;
}

export function ReciboPagos({ pago }) {
  const partes = pago?.pagos_desglose || [];
  if (!partes.length) return null;
  const efectivo = partes.find((p) => /efectivo/i.test(p.metodo_pago));
  return <>
    {partes.map((p) => <div className="print-line" key={p.metodo_pago_id}><span>{p.metodo_pago}</span><span>${Number(p.monto).toLocaleString("es-CO")}</span></div>)}
    {efectivo && <>
      <div className="print-line"><span>Efectivo recibido</span><span>${Number(pago.efectivo_recibido ?? (Number(efectivo.monto) + Number(pago.cambio || 0))).toLocaleString("es-CO")}</span></div>
      <div className="print-line"><span>Cambio</span><span>${Number(pago.cambio || 0).toLocaleString("es-CO")}</span></div>
    </>}
  </>;
}
