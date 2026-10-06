import { useEffect, useMemo, useState } from "react";
import api from "../../api/api.js";

function fechaBogotaISO() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const valores = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

const hoy = fechaBogotaISO();
const mesActual = hoy.slice(0, 7);

const gastoVacio = {
  concepto: "",
  tipo: "FIJO",
  categoria: "",
  fecha: hoy,
  mes: mesActual,
  cantidad: 1,
  valor_unitario: 0,
  recurrente: false,
  descripcion: "",
  sucursal_id: "",
};

const horaVacia = {
  usuario_id: "",
  tipo: "EXTRA_DIURNA",
  fecha: hoy,
  hora_inicio: "",
  horas: 1,
  valor_hora: 0,
  observacion: "",
};

export default function UtilidadNetaAdmin() {
  const [mes, setMes] = useState(mesActual);
  const [resumen, setResumen] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [horas, setHoras] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [gastoForm, setGastoForm] = useState(gastoVacio);
  const [editandoGastoId, setEditandoGastoId] = useState(null);
  const [horaForm, setHoraForm] = useState(horaVacia);
  const [editandoHoraId, setEditandoHoraId] = useState(null);
  const [filtroEmpleadoHoras, setFiltroEmpleadoHoras] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarDatos();
  }, [mes]);

  async function cargarDatos() {
    try {
      const [utilidadRes, gastosRes, horasRes, empleadosRes, sucursalesRes] =
        await Promise.all([
          api.get(`/configuracion-admin/utilidad?mes=${mes}`),
          api.get(`/configuracion-admin/gastos?mes=${mes}`),
          api.get(`/configuracion-admin/horas-extra?mes=${mes}`),
          api.get("/usuarios/empleados"),
          api.get("/configuracion-admin/sucursales"),
        ]);

      setResumen(utilidadRes.data.resumen || null);
      setGastos(gastosRes.data.gastos || []);
      setHoras(horasRes.data.horas || []);
      setEmpleados(empleadosRes.data.empleados || []);
      setSucursales(sucursalesRes.data.sucursales || []);
    } catch {
      setMensaje("No se pudo cargar utilidad neta.");
    }
  }

  function moneda(valor) {
    return `$${Number(valor || 0).toLocaleString("es-CO")}`;
  }

  const gastoTotalPreview = useMemo(
    () => Number(gastoForm.cantidad || 0) * Number(gastoForm.valor_unitario || 0),
    [gastoForm.cantidad, gastoForm.valor_unitario],
  );

  const horaTotalPreview = useMemo(
    () =>
      Number(horaForm.horas || 0) *
      Number(horaForm.valor_hora || 0),
    [horaForm.horas, horaForm.valor_hora],
  );

  async function guardarGasto(e) {
    e.preventDefault();

    try {
      const payload = { ...gastoForm, monto: gastoTotalPreview };

      if (editandoGastoId) {
        await api.put(`/configuracion-admin/gastos/${editandoGastoId}`, payload);
      } else {
        await api.post("/configuracion-admin/gastos", payload);
      }

      setGastoForm({ ...gastoVacio, mes });
      setEditandoGastoId(null);
      setMensaje("Gasto registrado.");
      cargarDatos();
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo registrar el gasto.");
    }
  }

  function cambiarTipoGasto(tipo) {
    setGastoForm({
      ...gastoForm,
      tipo,
      cantidad:
        tipo === "EMPLEADOS"
          ? resumen?.empleados_activos || gastoForm.cantidad || 1
          : gastoForm.cantidad,
    });
  }

  async function guardarHora(e) {
    e.preventDefault();

    try {
      const empleado = empleados.find((item) => item.id === Number(horaForm.usuario_id));
      const payload = {
        ...horaForm,
        sucursal_id: empleado?.sucursal_id || null,
      };

      if (editandoHoraId) {
        await api.put(`/configuracion-admin/horas-extra/${editandoHoraId}`, payload);
      } else {
        await api.post("/configuracion-admin/horas-extra", payload);
      }

      setHoraForm(horaVacia);
      setEditandoHoraId(null);
      setMensaje(editandoHoraId ? "Hora extra actualizada." : "Hora extra registrada.");
      cargarDatos();
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo registrar la hora extra.");
    }
  }

  async function eliminarGasto(id) {
    if (!confirm("Deseas eliminar este gasto?")) return;
    await api.delete(`/configuracion-admin/gastos/${id}`);
    cargarDatos();
  }

  function editarGasto(gasto) {
    setEditandoGastoId(gasto.id);
    setGastoForm({
      concepto: gasto.concepto || "",
      tipo: gasto.tipo || "VARIABLE",
      categoria: gasto.categoria || "",
      fecha: String(gasto.fecha || hoy).slice(0, 10),
      mes,
      cantidad: gasto.cantidad || 1,
      valor_unitario: gasto.valor_unitario || gasto.monto || 0,
      descripcion: gasto.descripcion || "",
      sucursal_id: gasto.sucursal_id || "",
      recurrente: gasto.recurrente || false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarHora(id) {
    if (!confirm("Deseas eliminar este registro?")) return;
    await api.delete(`/configuracion-admin/horas-extra/${id}`);
    cargarDatos();
  }

  function editarHora(hora) {
    setEditandoHoraId(hora.id);
    setHoraForm({
      usuario_id: hora.usuario_id || "",
      tipo: hora.tipo || "EXTRA_DIURNA",
      fecha: String(hora.fecha || hoy).slice(0, 10),
      hora_inicio: hora.hora_inicio ? String(hora.hora_inicio).slice(0, 5) : "",
      horas: hora.horas || 1,
      valor_hora: hora.valor_hora || 0,
      observacion: hora.observacion || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const r = resumen || {};
  const horasFiltradas = horas.filter((hora) =>
    !filtroEmpleadoHoras || Number(hora.usuario_id) === Number(filtroEmpleadoHoras),
  );
  const totalHorasFiltradas = horasFiltradas.reduce(
    (acc, hora) => acc + Number(hora.total || 0),
    0,
  );
  const cantidadHorasFiltradas = horasFiltradas.reduce(
    (acc, hora) => acc + Number(hora.horas || 0),
    0,
  );

  return (
    <div>
      {mensaje && <div className="info-message">{mensaje}</div>}

      <div className="panel-card">
        <div className="recipe-detail-header">
          <h2>Utilidad neta</h2>
          <label className="month-filter">
            Mes
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </label>
        </div>

        <div className="utility-summary-grid">
          <div className="utility-summary-card">
            <span>Ventas del mes</span>
            <strong>{moneda(r.ventas)}</strong>
            <p>{r.cantidad_ventas || 0} ventas validas</p>
          </div>
          <div className="utility-summary-card">
            <span>Gastos</span>
            <strong>{moneda(r.gastos)}</strong>
            <p>Operativos y cierre de caja</p>
          </div>
          <div className="utility-summary-card">
            <span>Gastos cierre caja</span>
            <strong>{moneda(r.gastos_caja)}</strong>
            <p>Salidas registradas por dia</p>
          </div>
          <div className="utility-summary-card">
            <span>Comision datáfono</span>
            <strong>{moneda(r.comision_datafono)}</strong>
            <p>4,89% de ventas con tarjeta</p>
          </div>
          <div className="utility-summary-card">
            <span>Horas extra</span>
            <strong>{moneda(r.horas_extra)}</strong>
            <p>Registros del mes seleccionado</p>
          </div>
          <div className="utility-summary-card utility-summary-card-total">
            <span>Utilidad neta</span>
            <strong>{moneda(r.utilidad_neta)}</strong>
            <p>Ventas menos gastos y horas extra</p>
          </div>
        </div>
      </div>

      <div className="dashboard-two-columns">
        <div className="panel-card">
          <h2>{editandoGastoId ? "Editar gasto" : "Registrar gasto"}</h2>
          <form className="admin-form" onSubmit={guardarGasto}>
            <div className="form-grid">
              <label>
                Tipo
                <select
                  value={gastoForm.tipo}
                  onChange={(e) => cambiarTipoGasto(e.target.value)}
                >
                  <option value="FIJO">Gasto fijo</option>
                  <option value="VARIABLE">Recibo variable</option>
                  <option value="COMPRA">Compra puntual</option>
                  <option value="EMPLEADOS">Costo empleados</option>
                </select>
              </label>
              <label>
                Concepto
                <input
                  value={gastoForm.concepto}
                  onChange={(e) =>
                    setGastoForm({ ...gastoForm, concepto: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Categoria
                <input
                  placeholder="Luz, agua, nomina, harina..."
                  value={gastoForm.categoria}
                  onChange={(e) =>
                    setGastoForm({ ...gastoForm, categoria: e.target.value })
                  }
                />
              </label>
              <label>
                Fecha
                <input
                  type="date"
                  value={gastoForm.fecha}
                  onChange={(e) => setGastoForm({ ...gastoForm, fecha: e.target.value })}
                />
              </label>
              <label>
                Cantidad
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={gastoForm.cantidad}
                  onChange={(e) =>
                    setGastoForm({ ...gastoForm, cantidad: e.target.value })
                  }
                />
              </label>
              <label>
                Valor unitario
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={gastoForm.valor_unitario}
                  onChange={(e) =>
                    setGastoForm({ ...gastoForm, valor_unitario: e.target.value })
                  }
                />
              </label>
              <label>
                Sucursal
                <select
                  value={gastoForm.sucursal_id}
                  onChange={(e) =>
                    setGastoForm({ ...gastoForm, sucursal_id: e.target.value })
                  }
                >
                  <option value="">Todas / general</option>
                  {sucursales.map((sucursal) => (
                    <option key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={gastoForm.recurrente}
                  onChange={(e) =>
                    setGastoForm({ ...gastoForm, recurrente: e.target.checked })
                  }
                />
                Repetir cada mes
              </label>
              <label>
                Descripcion
                <textarea
                  value={gastoForm.descripcion}
                  onChange={(e) =>
                    setGastoForm({ ...gastoForm, descripcion: e.target.value })
                  }
                />
              </label>
            </div>
            <p>Total: <strong>{moneda(gastoTotalPreview)}</strong></p>
            {gastoForm.tipo === "EMPLEADOS" && (
              <p>Empleados activos: <strong>{r.empleados_activos || 0}</strong></p>
            )}
            <div className="action-row">
              <button className="btn btn-primary">
                {editandoGastoId ? "Actualizar gasto" : "Registrar gasto"}
              </button>
              {editandoGastoId && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setEditandoGastoId(null);
                    setGastoForm({ ...gastoVacio, mes });
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="panel-card">
          <h2>{editandoHoraId ? "Editar hora extra" : "Horas extra"}</h2>
          <form className="admin-form" onSubmit={guardarHora}>
            <div className="form-grid">
              <label>
                Empleado
                <select
                  value={horaForm.usuario_id}
                  onChange={(e) =>
                    setHoraForm({ ...horaForm, usuario_id: e.target.value })
                  }
                  required
                >
                  <option value="">Seleccionar</option>
                  {empleados.map((empleado) => (
                    <option key={empleado.id} value={empleado.id}>
                      {empleado.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select
                  value={horaForm.tipo}
                  onChange={(e) => setHoraForm({ ...horaForm, tipo: e.target.value })}
                >
                  <option value="EXTRA_DIURNA">Extra diurna</option>
                  <option value="EXTRA_NOCTURNA">Extra nocturna</option>
                  <option value="DOMINICAL_DIURNA">Dominical diurna</option>
                  <option value="DOMINICAL_NOCTURNA">Dominical nocturna</option>
                </select>
              </label>
              <label>
                Fecha
                <input
                  type="date"
                  value={horaForm.fecha}
                  onChange={(e) => setHoraForm({ ...horaForm, fecha: e.target.value })}
                />
              </label>
              <label>
                Hora
                <input
                  type="time"
                  value={horaForm.hora_inicio}
                  onChange={(e) =>
                    setHoraForm({ ...horaForm, hora_inicio: e.target.value })
                  }
                />
              </label>
              <label>
                Horas
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={horaForm.horas}
                  onChange={(e) => setHoraForm({ ...horaForm, horas: e.target.value })}
                />
              </label>
              <label>
                Valor hora
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={horaForm.valor_hora}
                  onChange={(e) =>
                    setHoraForm({ ...horaForm, valor_hora: e.target.value })
                  }
                />
              </label>
              <label>
                Observacion
                <textarea
                  value={horaForm.observacion}
                  onChange={(e) =>
                    setHoraForm({ ...horaForm, observacion: e.target.value })
                  }
                />
              </label>
            </div>
            <p>Total a pagar: <strong>{moneda(horaTotalPreview)}</strong></p>
            <div className="action-row">
              <button className="btn btn-primary">
                {editandoHoraId ? "Actualizar hora extra" : "Registrar hora extra"}
              </button>
              {editandoHoraId && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setEditandoHoraId(null);
                    setHoraForm(horaVacia);
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="dashboard-two-columns">
        <div className="panel-card">
          <h2>Gastos del mes</h2>
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Repite</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((gasto) => (
                  <tr key={gasto.id}>
                    <td>{String(gasto.fecha).slice(0, 10)}</td>
                    <td>{gasto.tipo}</td>
                    <td>{gasto.concepto}</td>
                    <td>{gasto.recurrente ? "Cada mes" : "Solo este mes"}</td>
                    <td>{moneda(gasto.monto)}</td>
                    <td>
                      <button className="mini-button" onClick={() => editarGasto(gasto)}>
                        Editar
                      </button>
                      <button className="mini-button danger" onClick={() => eliminarGasto(gasto.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel-card">
          <h2>Horas extra del mes</h2>
          <div className="utility-hour-filter">
            <label>
              Filtrar empleado
              <select
                value={filtroEmpleadoHoras}
                onChange={(e) => setFiltroEmpleadoHoras(e.target.value)}
              >
                <option value="">Todos</option>
                {empleados.map((empleado) => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span>Horas</span>
              <strong>{cantidadHorasFiltradas}</strong>
            </div>
            <div>
              <span>Total a pagar</span>
              <strong>{moneda(totalHorasFiltradas)}</strong>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Empleado</th>
                  <th>Tipo</th>
                  <th>Horas</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {horasFiltradas.map((hora) => (
                  <tr key={hora.id}>
                    <td>{String(hora.fecha).slice(0, 10)} {hora.hora_inicio || ""}</td>
                    <td>{hora.empleado_nombre}</td>
                    <td>{hora.tipo}</td>
                    <td>{hora.horas}</td>
                    <td>{moneda(hora.total)}</td>
                    <td>
                      <button className="mini-button" onClick={() => editarHora(hora)}>
                        Editar
                      </button>
                      <button className="mini-button danger" onClick={() => eliminarHora(hora.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
