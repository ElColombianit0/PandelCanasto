import { useEffect, useState } from "react";
import { Pencil, Printer, Trash2 } from "lucide-react";
import api from "../api/api.js";

const moneda = (valor) => `$${Number(valor || 0).toLocaleString("es-CO")}`;
const fechaHoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const historialVacio = () => ({ gastos: [], resumen: { total: 0, reintegrado: 0, pendiente: 0, cantidad: 0 } });
const formVacio = () => ({ fecha: fechaHoy(), descripcion: "", monto: "", metodo_salida: "EFECTIVO", etiqueta_id: "", comentario: "" });

export default function HistorialGastosCaja({ general = false, etiquetas, revision = 0, onEditar, onEliminar, onImprimir }) {
  const [mes, setMes] = useState(() => fechaHoy().slice(0, 7));
  const [etiquetaId, setEtiquetaId] = useState("");
  const [estado, setEstado] = useState("");
  const [historial, setHistorial] = useState(historialVacio);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [form, setForm] = useState(formVacio);
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [revisionGeneral, setRevisionGeneral] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCargando(true);
    setErrorCarga("");
    setHistorial(historialVacio());
    api.get(general ? "/caja/general" : "/caja/gastos/historial", {
      params: { mes, etiqueta_id: etiquetaId || undefined, estado: estado || undefined },
      signal: controller.signal,
    }).then(({ data }) => {
      if (!controller.signal.aborted) setHistorial(data);
    }).catch((error) => {
      if (!controller.signal.aborted) setErrorCarga(error.response?.data?.message || "No se pudo cargar el historial.");
    }).finally(() => {
      if (!controller.signal.aborted) setCargando(false);
    });
    return () => controller.abort();
  }, [mes, etiquetaId, estado, general, revision, revisionGeneral]);

  async function guardarGeneral(e) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setMensaje("");
    try {
      if (editandoId) await api.put(`/caja/general/${editandoId}`, form);
      else await api.post("/caja/general", form);
      setMes(form.fecha.slice(0, 7));
      setEtiquetaId("");
      setRevisionGeneral((value) => value + 1);
      setForm(formVacio());
      setEditandoId(null);
      setMensaje(editandoId ? "Registro actualizado." : "Gasto de caja general registrado.");
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo guardar el registro.");
    } finally {
      setGuardando(false);
    }
  }

  function editarGeneral(item) {
    setEditandoId(item.id);
    setForm({
      fecha: item.fecha,
      descripcion: item.descripcion,
      monto: item.monto,
      metodo_salida: item.metodo_salida,
      etiqueta_id: item.etiqueta_id == null ? "" : String(item.etiqueta_id),
      comentario: item.comentario || "",
    });
  }

  async function eliminarGeneral(item) {
    if (!window.confirm(`Eliminar el registro "${item.descripcion}" de caja general?`)) return;
    try {
      await api.delete(`/caja/general/${item.id}`);
      if (String(editandoId) === String(item.id)) {
        setEditandoId(null);
        setForm(formVacio());
      }
      setRevisionGeneral((value) => value + 1);
      setMensaje("Registro eliminado.");
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo eliminar el registro.");
    }
  }

  return (
    <section className="caja-history no-print" aria-label={general ? "Historial de caja general" : "Historial mensual de gastos"}>
      <h2>{general ? "Gastos de caja general" : "Historial mensual de gastos"}</h2>
      {general && <p className="caja-general-notice">Registro independiente del cierre diario y de las utilidades netas.</p>}
      {mensaje && <div className="info-message" role="status">{mensaje}</div>}

      {general && (
        <form className="admin-form caja-form" onSubmit={guardarGeneral}>
          <h3>{editandoId ? "Editar registro" : "Registrar gasto de caja general"}</h3>
          <fieldset disabled={guardando}>
            <div className="form-grid">
              <label>Fecha
                <input type="date" required value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </label>
              <label>Descripcion
                <input required maxLength={1000} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </label>
              <label>Monto
                <input type="number" min="0.01" step="0.01" required value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
              </label>
              <label>Sale de
                <select aria-label="Sale de" value={form.metodo_salida} onChange={(e) => setForm({ ...form, metodo_salida: e.target.value })}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                </select>
              </label>
              <label>Etiqueta
                <select aria-label="Etiqueta" value={form.etiqueta_id} onChange={(e) => setForm({ ...form, etiqueta_id: e.target.value })}>
                  <option value="">Sin etiqueta</option>
                  {etiquetas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </label>
              <label>Comentarios
                <textarea rows={2} maxLength={2000} value={form.comentario} onChange={(e) => setForm({ ...form, comentario: e.target.value })} />
              </label>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary">{guardando ? "Guardando..." : editandoId ? "Actualizar registro" : "Guardar registro"}</button>
              {editandoId && <button className="btn btn-outline" type="button" onClick={() => {
                setEditandoId(null);
                setForm(formVacio());
              }}>Cancelar</button>}
            </div>
          </fieldset>
        </form>
      )}

      <div className="sales-filter-bar caja-history-filters">
        <label>Mes
          <input type="month" value={mes} onChange={(e) => { if (e.target.value) setMes(e.target.value); }} />
        </label>
        <label>Etiqueta
          <select aria-label="Etiqueta" value={etiquetaId} onChange={(e) => setEtiquetaId(e.target.value)}>
            <option value="">Todas las etiquetas</option>
            {etiquetas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </label>
        {!general && <label>Reintegro
          <select aria-label="Reintegro" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="PENDIENTE">Sin reintegrar</option>
            <option value="REINTEGRADO">Reintegrado</option>
          </select>
        </label>}
      </div>

      {errorCarga && <div className="info-message" role="alert">{errorCarga}</div>}
      {!errorCarga && <>
        <div className="caja-history-totals" aria-busy={cargando}>
          <div><span>Total registrado</span><strong>{cargando ? "..." : moneda(historial.resumen.total)}</strong></div>
          {!general && <>
            <div><span>Reintegrado</span><strong>{cargando ? "..." : moneda(historial.resumen.reintegrado)}</strong></div>
            <div><span>Sin reintegrar</span><strong>{cargando ? "..." : moneda(historial.resumen.pendiente)}</strong></div>
          </>}
          <div><span>Registros</span><strong>{cargando ? "..." : historial.resumen.cantidad}</strong></div>
        </div>
        <div className="table-wrapper">
          <table className="admin-table caja-history-table" aria-busy={cargando}>
            <thead><tr>
              <th>Fecha</th><th>Descripcion</th><th>Etiqueta</th><th>Monto</th><th>Sale de</th>
              {!general && <th>Reintegro</th>}<th>Comentarios</th><th>Acciones</th>
            </tr></thead>
            <tbody>
              {cargando && <tr><td colSpan={general ? 7 : 8}>Cargando historial...</td></tr>}
              {!cargando && historial.gastos.map((item) => <tr key={item.id}>
                <td className="caja-date">{item.fecha.split("-").reverse().join("/")}</td>
                <td className="caja-comentario">{item.descripcion}</td>
                <td>{item.etiqueta_nombre || "Sin etiqueta"}</td>
                <td className="caja-amount">{moneda(item.monto)}</td>
                <td>{item.metodo_salida === "TRANSFERENCIA" ? "Transferencia" : "Efectivo"}</td>
                {!general && <td>{item.reintegrado ? "Reintegrado" : "Sin reintegrar"}</td>}
                <td className="caja-comentario">{item.comentario || "-"}</td>
                <td><div className="caja-row-actions">
                  <button type="button" className="mini-button" aria-label="Editar gasto" title="Editar gasto"
                    onClick={() => general ? editarGeneral(item) : onEditar(item)}><Pencil size={16} /></button>
                  {!general && <button type="button" className="mini-button" aria-label="Imprimir recibo" title="Imprimir recibo"
                    onClick={() => onImprimir(item)}><Printer size={16} /></button>}
                  <button type="button" className="mini-button danger" aria-label="Eliminar gasto" title="Eliminar gasto"
                    onClick={() => general ? eliminarGeneral(item) : onEliminar(item.id)}><Trash2 size={16} /></button>
                </div></td>
              </tr>)}
              {!cargando && !historial.gastos.length && <tr><td colSpan={general ? 7 : 8}>No hay gastos para estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </>}
    </section>
  );
}
