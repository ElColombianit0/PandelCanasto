import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Plus } from "lucide-react";
import api from "../../api/api.js";
import HistorialGastosCaja from "../../components/HistorialGastosCaja.jsx";
import "../../styles/caja.css";

function fechaBogota() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

function gastoVacio() {
  return { descripcion: "", monto: "", metodo_salida: "EFECTIVO", etiqueta_id: "", comentario: "", reintegrado: false };
}

export default function CierreCajaAdmin() {
  const [fecha, setFecha] = useState(fechaBogota());
  const [data, setData] = useState({
    ventas: [],
    gastos: [],
    gastos_resumen: [],
    productos_vendidos: [],
  });
  const [mensaje, setMensaje] = useState("");
  const [printMode, setPrintMode] = useState("cierre");
  const [gastoImprimir, setGastoImprimir] = useState(null);
  const [gasto, setGasto] = useState(gastoVacio);
  const [editandoGastoId, setEditandoGastoId] = useState(null);
  const [etiquetas, setEtiquetas] = useState([]);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const [guardandoEtiqueta, setGuardandoEtiqueta] = useState(false);
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [cargandoCaja, setCargandoCaja] = useState(true);
  const [revisionHistorial, setRevisionHistorial] = useState(0);
  const ultimaCarga = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/caja/etiquetas", { signal: controller.signal })
      .then(({ data }) => setEtiquetas(data.etiquetas || []))
      .catch(() => {
        if (!controller.signal.aborted) setMensaje("No se pudieron cargar las etiquetas.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    cargarCaja();
  }, [fecha]);

  async function cargarCaja() {
    const carga = ++ultimaCarga.current;
    setCargandoCaja(true);
    try {
      const { data } = await api.get(`/caja?fecha=${fecha}`);
      if (carga === ultimaCarga.current) setData(data);
    } catch {
      if (carga === ultimaCarga.current) setMensaje("No se pudo cargar el cierre de caja.");
    } finally {
      if (carga === ultimaCarga.current) setCargandoCaja(false);
    }
  }

  async function crearEtiqueta() {
    if (!nuevaEtiqueta.trim() || guardandoEtiqueta) return;
    setGuardandoEtiqueta(true);
    try {
      const { data } = await api.post("/caja/etiquetas", { nombre: nuevaEtiqueta.trim() });
      setEtiquetas((items) => [...items, data.etiqueta].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
      setGasto((actual) => ({ ...actual, etiqueta_id: String(data.etiqueta.id) }));
      setNuevaEtiqueta("");
      setMensaje("Etiqueta creada.");
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo crear la etiqueta.");
    } finally {
      setGuardandoEtiqueta(false);
    }
  }

  async function guardarGasto(e) {
    e.preventDefault();
    if (guardandoGasto || guardandoEtiqueta) return;
    setMensaje("");
    setGuardandoGasto(true);

    try {
      if (editandoGastoId) {
        await api.put(`/caja/gastos/${editandoGastoId}`, { ...gasto, fecha });
      } else {
        await api.post("/caja/gastos", { ...gasto, fecha });
      }
      setGasto(gastoVacio());
      setEditandoGastoId(null);
      setRevisionHistorial((revision) => revision + 1);
      await cargarCaja();
      setMensaje(editandoGastoId ? "Gasto actualizado." : "Gasto registrado.");
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo registrar el gasto.");
    } finally {
      setGuardandoGasto(false);
    }
  }

  function editarGasto(item) {
    setFecha(String(item.fecha).slice(0, 10));
    setEditandoGastoId(item.id);
    setGasto({
      descripcion: item.descripcion || "",
      monto: item.monto || "",
      metodo_salida: item.metodo_salida || "EFECTIVO",
      etiqueta_id: item.etiqueta_id == null ? "" : String(item.etiqueta_id),
      comentario: item.comentario || "",
      reintegrado: Boolean(item.reintegrado),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarGasto(id) {
    if (!confirm("Deseas eliminar este gasto?")) return;

    try {
      await api.delete(`/caja/gastos/${id}`);
      if (String(editandoGastoId) === String(id)) {
        setEditandoGastoId(null);
        setGasto(gastoVacio());
      }
      setRevisionHistorial((revision) => revision + 1);
      await cargarCaja();
      setMensaje("Gasto eliminado.");
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo eliminar el gasto.");
    }
  }

  function imprimirCierre() {
    setPrintMode("cierre");
    setGastoImprimir(null);
    setTimeout(() => window.print(), 100);
  }

  function imprimirGasto(item) {
    setPrintMode("gasto");
    setGastoImprimir(item);
    setTimeout(() => window.print(), 100);
  }

  function totalPorMetodo(nombre) {
    return Number(
      (data.ventas || []).find((item) =>
        String(item.metodo_pago || "").toLowerCase().includes(nombre),
      )?.total || 0,
    );
  }

  function gastoPorMetodo(nombre) {
    return Number(
      (data.gastos_resumen || []).find((item) =>
        String(item.metodo_salida || "").toLowerCase().includes(nombre),
      )?.total || 0,
    );
  }

  const resumen = useMemo(() => {
    const efectivo = totalPorMetodo("efectivo");
    const transferencia = totalPorMetodo("transfer");
    const tarjeta = totalPorMetodo("tarjeta");
    const gastosEfectivo = gastoPorMetodo("efectivo");
    const gastosTransferencia = gastoPorMetodo("transfer");
    const totalGastos = (data.gastos || []).reduce(
      (acc, item) => acc + Number(item.monto || 0),
      0,
    );
    const comisionTarjeta = tarjeta * 0.0489;

    return {
      efectivo,
      transferencia,
      tarjeta,
      gastosEfectivo,
      gastosTransferencia,
      totalGastos,
      comisionTarjeta,
      efectivoNeto: efectivo - gastosEfectivo,
      transferenciaNeta: transferencia - gastosTransferencia,
      tarjetaNeta: tarjeta - comisionTarjeta,
    };
  }, [data]);

  const moneda = (valor) => `$${Number(valor || 0).toLocaleString("es-CO")}`;

  return (
    <div className="caja-page">
      {mensaje && <div className="info-message no-print" role="status">{mensaje}</div>}

      <div className="panel-card no-print">
        <h2>Cierre de caja</h2>

        <div className="sales-filter-bar">
          <label>
            Dia
            <input type="date" value={fecha} required onChange={(e) => {
              if (!e.target.value) return;
              setFecha(e.target.value);
              setEditandoGastoId(null);
              setGasto(gastoVacio());
            }} />
          </label>

          <button className="btn btn-primary" type="button" onClick={imprimirCierre}
            disabled={cargandoCaja || data.fecha !== fecha || guardandoGasto}>
            Imprimir cierre
          </button>
        </div>

        <div className="payment-summary-grid">
          <div>
            <span>Efectivo ventas</span>
            <strong>{moneda(resumen.efectivo)}</strong>
            <small>Gastos efectivo: {moneda(resumen.gastosEfectivo)}</small>
          </div>
          <div>
            <span>Efectivo en caja</span>
            <strong>{moneda(resumen.efectivoNeto)}</strong>
            <small>Despues de gastos</small>
          </div>
          <div>
            <span>Transferencias ventas</span>
            <strong>{moneda(resumen.transferencia)}</strong>
            <small>Gastos transferencia: {moneda(resumen.gastosTransferencia)}</small>
          </div>
          <div>
            <span>Transferencias netas</span>
            <strong>{moneda(resumen.transferenciaNeta)}</strong>
            <small>Despues de gastos</small>
          </div>
          <div>
            <span>Tarjeta ventas</span>
            <strong>{moneda(resumen.tarjeta)}</strong>
            <small>Comision datáfono: {moneda(resumen.comisionTarjeta)}</small>
          </div>
          <div>
            <span>Tarjeta neta</span>
            <strong>{moneda(resumen.tarjetaNeta)}</strong>
            <small>Despues de descontar 4,89%</small>
          </div>
          <div>
            <span>Total gastos</span>
            <strong>{moneda(resumen.totalGastos)}</strong>
            <small>Efectivo y transferencia</small>
          </div>
        </div>
      </div>

      <div className="panel-card no-print">
        <h2>{editandoGastoId ? "Editar gasto" : "Registrar gasto"}</h2>

        <form className="admin-form caja-form" onSubmit={guardarGasto}>
          <fieldset disabled={guardandoGasto}>
          <div className="form-grid">
            <label>
              Descripcion
              <input
                value={gasto.descripcion}
                onChange={(e) => setGasto({ ...gasto, descripcion: e.target.value })}
                placeholder="Jabon para cocina"
                maxLength={1000}
                required
              />
            </label>

            <label>
              Monto
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={gasto.monto}
                onChange={(e) => setGasto({ ...gasto, monto: e.target.value })}
                required
              />
            </label>

            <label>
              Sale de
              <select
                className="nice-select"
                aria-label="Sale de"
                value={gasto.metodo_salida}
                onChange={(e) => setGasto({ ...gasto, metodo_salida: e.target.value })}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </label>
            <label>
              Etiqueta
              <select aria-label="Etiqueta" value={gasto.etiqueta_id} onChange={(e) => setGasto({ ...gasto, etiqueta_id: e.target.value })}>
                <option value="">Sin etiqueta</option>
                {etiquetas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </label>
            <label className="caja-form-wide">
              Comentarios
              <textarea rows={2} maxLength={2000} value={gasto.comentario}
                onChange={(e) => setGasto({ ...gasto, comentario: e.target.value })}
                placeholder="Ejemplo: ya lo pago" />
            </label>
          </div>

          <label className="caja-checkbox" title="Marca informativa: conserva el gasto del cierre y no registra un ingreso.">
            <input type="checkbox" checked={gasto.reintegrado}
              onChange={(e) => setGasto({ ...gasto, reintegrado: e.target.checked })} />
            Reintegrado
          </label>

          <details className="caja-etiquetas">
            <summary>Crear etiqueta</summary>
            <div className="caja-etiqueta-form">
              <label>Nueva etiqueta
                <input value={nuevaEtiqueta} maxLength={80} placeholder="Paola"
                  onChange={(e) => setNuevaEtiqueta(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); crearEtiqueta(); } }} />
              </label>
              <button type="button" className="btn btn-outline" onClick={crearEtiqueta}
                disabled={guardandoEtiqueta || !nuevaEtiqueta.trim()}>
                <Plus size={16} /> {guardandoEtiqueta ? "Guardando..." : "Crear"}
              </button>
            </div>
          </details>

          <div className="form-actions">
            <button className="btn btn-primary" disabled={guardandoEtiqueta}>
              {guardandoGasto ? "Guardando..." : editandoGastoId ? "Actualizar gasto" : "Guardar gasto"}
            </button>
            {editandoGastoId && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setEditandoGastoId(null);
                  setGasto(gastoVacio());
                }}
              >
                Cancelar
              </button>
            )}
          </div>
          </fieldset>
        </form>
      </div>

      <div className="panel-card no-print">
        <h2>Gastos del dia</h2>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Descripcion</th>
                <th>Monto</th>
                <th>Sale de</th>
                <th>Etiqueta</th>
                <th>Comentarios</th>
                <th>Reintegro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(data.gastos || []).map((item) => (
                <tr key={item.id}>
                  <td>{item.descripcion}</td>
                  <td>{moneda(item.monto)}</td>
                  <td>{item.metodo_salida}</td>
                  <td>{item.etiqueta_nombre || "Sin etiqueta"}</td>
                  <td className="caja-comentario">{item.comentario || "-"}</td>
                  <td>{item.reintegrado ? "Reintegrado" : "Sin reintegrar"}</td>
                  <td>
                    <button className="mini-button" onClick={() => editarGasto(item)}>
                      Editar
                    </button>
                    <button className="mini-button" onClick={() => imprimirGasto(item)}>
                      Imprimir
                    </button>
                    <button className="mini-button danger" onClick={() => eliminarGasto(item.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {(data.gastos || []).length === 0 && (
                <tr>
                  <td colSpan="7">No hay gastos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <HistorialGastosCaja etiquetas={etiquetas} revision={revisionHistorial}
        onEditar={editarGasto} onEliminar={eliminarGasto} onImprimir={imprimirGasto} />

      <details className="caja-general no-print">
        <summary><Archive size={18} /> Caja general</summary>
        <HistorialGastosCaja general etiquetas={etiquetas} />
      </details>

      <div className="panel-card no-print">
        <h2>Productos vendidos del dia</h2>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(data.productos_vendidos || []).map((item) => (
                <tr key={item.id}>
                  <td>{item.nombre}</td>
                  <td>{Number(item.cantidad || 0).toLocaleString("es-CO")}</td>
                  <td>{moneda(item.total)}</td>
                </tr>
              ))}
              {(data.productos_vendidos || []).length === 0 && (
                <tr>
                  <td colSpan="3">No hay productos vendidos en este dia.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {printMode === "cierre" && (
        <div className="print-receipt">
          <h3>Pan del Canasto</h3>
          <p>Cierre de caja</p>
          <p>Fecha: {fecha}</p>
          <div className="print-divider" />
          <div className="print-line"><span>Efectivo ventas</span><span>{moneda(resumen.efectivo)}</span></div>
          <div className="print-line"><span>Gastos efectivo</span><span>{moneda(resumen.gastosEfectivo)}</span></div>
          <div className="print-line"><strong>Efectivo caja</strong><strong>{moneda(resumen.efectivoNeto)}</strong></div>
          <div className="print-line"><span>Transfer ventas</span><span>{moneda(resumen.transferencia)}</span></div>
          <div className="print-line"><span>Gastos transfer</span><span>{moneda(resumen.gastosTransferencia)}</span></div>
          <div className="print-line"><strong>Transfer neta</strong><strong>{moneda(resumen.transferenciaNeta)}</strong></div>
          <div className="print-line"><span>Tarjeta ventas</span><span>{moneda(resumen.tarjeta)}</span></div>
          <div className="print-line"><span>Comision 4.89%</span><span>{moneda(resumen.comisionTarjeta)}</span></div>
          <div className="print-line"><strong>Tarjeta neta</strong><strong>{moneda(resumen.tarjetaNeta)}</strong></div>
          <div className="print-line"><strong>Total gastos</strong><strong>{moneda(resumen.totalGastos)}</strong></div>
          <div className="print-divider" />
          <p>Gastos registrados</p>
          {(data.gastos || []).map((item) => (
            <p className="print-expense-line" key={item.id}>
              {item.descripcion}: {moneda(item.monto)} ({item.metodo_salida})
              {item.etiqueta_nombre && <> - {item.etiqueta_nombre}</>}
            </p>
          ))}
          <div className="print-divider" />
          <p>Productos vendidos</p>
          {(data.productos_vendidos || []).map((item) => (
            <div className="print-line" key={item.id}>
              <span>{Number(item.cantidad || 0).toLocaleString("es-CO")} x {item.nombre}</span>
              <span>{moneda(item.total)}</span>
            </div>
          ))}
          <div className="print-divider" />
          <p>Soporte de cierre</p>
        </div>
      )}

      {printMode === "gasto" && gastoImprimir && (
        <div className="print-receipt">
          <h3>Pan del Canasto</h3>
          <p>Recibo de gasto</p>
          <p>Fecha: {String(gastoImprimir.fecha || fecha).slice(0, 10)}</p>
          <div className="print-divider" />
          <div className="print-line"><span>Descripcion</span><span>{gastoImprimir.descripcion}</span></div>
          <div className="print-line"><span>Monto</span><span>{moneda(gastoImprimir.monto)}</span></div>
          <div className="print-line"><span>Sale de</span><span>{gastoImprimir.metodo_salida}</span></div>
          <div className="print-line"><span>Registrado por</span><span>{gastoImprimir.usuario_nombre || "Admin"}</span></div>
          {gastoImprimir.etiqueta_nombre && <div className="print-line"><span>Etiqueta</span><span>{gastoImprimir.etiqueta_nombre}</span></div>}
          {gastoImprimir.reintegrado && <p className="print-expense-line">Reintegrado</p>}
          {gastoImprimir.comentario && <p className="print-expense-line">{gastoImprimir.comentario}</p>}
          <div className="print-divider" />
          <p className="receipt-signature">Firma recibido</p>
          <p>________________________</p>
        </div>
      )}
    </div>
  );
}
