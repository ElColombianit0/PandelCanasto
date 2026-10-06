import { useEffect, useMemo, useState } from "react";
import api from "../../api/api.js";

function fechaBogota() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
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
  const [gasto, setGasto] = useState({
    descripcion: "",
    monto: "",
    metodo_salida: "EFECTIVO",
  });
  const [editandoGastoId, setEditandoGastoId] = useState(null);

  useEffect(() => {
    cargarCaja();
  }, [fecha]);

  async function cargarCaja() {
    try {
      const { data } = await api.get(`/caja?fecha=${fecha}`);
      setData(data);
    } catch {
      setMensaje("No se pudo cargar el cierre de caja.");
    }
  }

  async function guardarGasto(e) {
    e.preventDefault();
    setMensaje("");

    try {
      if (editandoGastoId) {
        await api.put(`/caja/gastos/${editandoGastoId}`, { ...gasto, fecha });
      } else {
        await api.post("/caja/gastos", { ...gasto, fecha });
      }
      setGasto({ descripcion: "", monto: "", metodo_salida: "EFECTIVO" });
      setEditandoGastoId(null);
      await cargarCaja();
      setMensaje(editandoGastoId ? "Gasto actualizado." : "Gasto registrado.");
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo registrar el gasto.");
    }
  }

  function editarGasto(item) {
    setEditandoGastoId(item.id);
    setGasto({
      descripcion: item.descripcion || "",
      monto: item.monto || "",
      metodo_salida: item.metodo_salida || "EFECTIVO",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarGasto(id) {
    if (!confirm("Deseas eliminar este gasto?")) return;

    try {
      await api.delete(`/caja/gastos/${id}`);
      if (String(editandoGastoId) === String(id)) {
        setEditandoGastoId(null);
        setGasto({ descripcion: "", monto: "", metodo_salida: "EFECTIVO" });
      }
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
    <div>
      {mensaje && <div className="info-message">{mensaje}</div>}

      <div className="panel-card no-print">
        <h2>Cierre de caja</h2>

        <div className="sales-filter-bar">
          <label>
            Dia
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>

          <button className="btn btn-primary" type="button" onClick={imprimirCierre}>
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

        <form className="admin-form" onSubmit={guardarGasto}>
          <div className="form-grid">
            <label>
              Descripcion
              <input
                value={gasto.descripcion}
                onChange={(e) => setGasto({ ...gasto, descripcion: e.target.value })}
                placeholder="Jabon para cocina"
                required
              />
            </label>

            <label>
              Monto
              <input
                type="number"
                min="0"
                value={gasto.monto}
                onChange={(e) => setGasto({ ...gasto, monto: e.target.value })}
                required
              />
            </label>

            <label>
              Sale de
              <select
                className="nice-select"
                value={gasto.metodo_salida}
                onChange={(e) => setGasto({ ...gasto, metodo_salida: e.target.value })}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </label>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary">
              {editandoGastoId ? "Actualizar gasto" : "Guardar gasto"}
            </button>
            {editandoGastoId && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setEditandoGastoId(null);
                  setGasto({ descripcion: "", monto: "", metodo_salida: "EFECTIVO" });
                }}
              >
                Cancelar
              </button>
            )}
          </div>
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
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(data.gastos || []).map((item) => (
                <tr key={item.id}>
                  <td>{item.descripcion}</td>
                  <td>{moneda(item.monto)}</td>
                  <td>{item.metodo_salida}</td>
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
                  <td colSpan="4">No hay gastos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
          <p>Fecha: {fecha}</p>
          <div className="print-divider" />
          <div className="print-line"><span>Descripcion</span><span>{gastoImprimir.descripcion}</span></div>
          <div className="print-line"><span>Monto</span><span>{moneda(gastoImprimir.monto)}</span></div>
          <div className="print-line"><span>Sale de</span><span>{gastoImprimir.metodo_salida}</span></div>
          <div className="print-line"><span>Registrado por</span><span>{gastoImprimir.usuario_nombre || "Admin"}</span></div>
          <div className="print-divider" />
          <p className="receipt-signature">Firma recibido</p>
          <p>________________________</p>
        </div>
      )}
    </div>
  );
}
