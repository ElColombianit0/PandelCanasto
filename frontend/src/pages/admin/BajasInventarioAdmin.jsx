import { useEffect, useState } from "react";
import api from "../../api/api.js";

function fechaBogota() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

export default function BajasInventarioAdmin() {
  const [fecha, setFecha] = useState(fechaBogota());
  const [inventario, setInventario] = useState([]);
  const [bajas, setBajas] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [busquedaInventario, setBusquedaInventario] = useState("");
  const [form, setForm] = useState({
    inventario_id: "",
    cantidad: "",
    descripcion: "",
  });
  const [editandoBajaId, setEditandoBajaId] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, [fecha]);

  async function cargarDatos() {
    try {
      const { data } = await api.get(`/bajas-inventario?fecha=${fecha}`);
      setInventario(data.inventario || []);
      setBajas(data.bajas || []);
    } catch {
      setMensaje("No se pudieron cargar las bajas.");
    }
  }

  async function guardarBaja(e) {
    e.preventDefault();
    setMensaje("");

    try {
      if (editandoBajaId) {
        await api.put(`/bajas-inventario/${editandoBajaId}`, { ...form, fecha });
      } else {
        await api.post("/bajas-inventario", { ...form, fecha });
      }
      setForm({ inventario_id: "", cantidad: "", descripcion: "" });
      setEditandoBajaId(null);
      await cargarDatos();
      setMensaje(editandoBajaId ? "Baja actualizada." : "Baja registrada.");
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo registrar la baja.");
    }
  }

  function editarBaja(item) {
    setEditandoBajaId(item.id);
    setForm({
      inventario_id: item.inventario_id || "",
      cantidad: item.cantidad || "",
      descripcion: item.descripcion || "",
    });
    setBusquedaInventario(item.inventario_nombre || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarBaja(id) {
    if (!confirm("Deseas eliminar esta baja y devolver el stock?")) return;

    try {
      await api.delete(`/bajas-inventario/${id}`);
      if (String(editandoBajaId) === String(id)) {
        setEditandoBajaId(null);
        setForm({ inventario_id: "", cantidad: "", descripcion: "" });
      }
      await cargarDatos();
      setMensaje("Baja eliminada y stock devuelto.");
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo eliminar la baja.");
    }
  }

  const numero = (valor) => Number(valor || 0).toLocaleString("es-CO");
  const moneda = (valor) => `$${Number(valor || 0).toLocaleString("es-CO")}`;
  const inventarioFiltrado = inventario.filter((item) =>
    item.nombre.toLowerCase().includes(busquedaInventario.toLowerCase()),
  );
  const itemSeleccionado = inventario.find(
    (item) => String(item.id) === String(form.inventario_id),
  );
  const costoUnitarioSeleccionado = Number(itemSeleccionado?.costo_unitario || 0);
  const perdidaEstimada = costoUnitarioSeleccionado * Number(form.cantidad || 0);

  return (
    <div>
      {mensaje && <div className="info-message">{mensaje}</div>}

      <div className="panel-card">
        <h2>{editandoBajaId ? "Editar baja de inventario" : "Dar de baja inventario"}</h2>

        <div className="sales-filter-bar">
          <label>
            Dia
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
        </div>

        <form className="admin-form" onSubmit={guardarBaja}>
          <div className="form-grid">
            <label>
              Buscar producto
              <input
                type="search"
                value={busquedaInventario}
                onChange={(e) => setBusquedaInventario(e.target.value)}
                placeholder="Buscar en inventario..."
              />
            </label>

            <label>
              Producto / inventario
              <select
                className="nice-select"
                value={form.inventario_id}
                onChange={(e) => setForm({ ...form, inventario_id: e.target.value })}
                required
              >
                <option value="">Seleccionar</option>
                {inventarioFiltrado.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} - Stock {numero(item.cantidad_actual)}{" "}
                    {item.unidad_abreviatura || ""} - Costo {moneda(item.costo_unitario)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Cantidad
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                required
              />
            </label>
          </div>

          {itemSeleccionado && (
            <div className="payment-summary-grid">
              <div>
                <span>Costo unitario</span>
                <strong>{moneda(costoUnitarioSeleccionado)}</strong>
                <small>Valor configurado en inventario</small>
              </div>
              <div>
                <span>Perdida estimada</span>
                <strong>{moneda(perdidaEstimada)}</strong>
                <small>
                  {numero(form.cantidad)} x {moneda(costoUnitarioSeleccionado)}
                </small>
              </div>
            </div>
          )}

          <label>
            Descripcion / motivo
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Producto con 3 dias en vitrina, ya no esta fresco"
              required
            />
          </label>

          <div className="form-actions">
            <button className="btn btn-primary">
              {editandoBajaId ? "Actualizar baja" : "Registrar baja"}
            </button>
            {editandoBajaId && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setEditandoBajaId(null);
                  setForm({ inventario_id: "", cantidad: "", descripcion: "" });
                  setBusquedaInventario("");
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="panel-card">
        <h2>Bajas registradas</h2>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Costo unitario</th>
                <th>Perdida</th>
                <th>Motivo</th>
                <th>Usuario</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {bajas.map((item) => (
                <tr key={item.id}>
                  <td>{item.inventario_nombre}</td>
                  <td>{numero(item.cantidad)} {item.unidad_abreviatura || ""}</td>
                  <td>{moneda(item.costo_unitario_momento)}</td>
                  <td>{moneda(item.costo_total)}</td>
                  <td>{item.descripcion}</td>
                  <td>{item.usuario_nombre || "Admin"}</td>
                  <td>
                    <button className="mini-button" onClick={() => editarBaja(item)}>
                      Editar
                    </button>
                    <button className="mini-button danger" onClick={() => eliminarBaja(item.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}

              {bajas.length === 0 && (
                <tr>
                  <td colSpan="7">No hay bajas registradas para este dia.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
