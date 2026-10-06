import { useEffect, useState } from "react";
import api from "../../api/api.js";

const sucursalVacia = { nombre: "", direccion: "", telefono: "" };

export default function ConfiguracionAdmin() {
  const [costos, setCostos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [sucursalForm, setSucursalForm] = useState(sucursalVacia);
  const [editandoSucursal, setEditandoSucursal] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      const [costosRes, sucursalesRes] = await Promise.all([
        api.get("/configuracion-admin/costos"),
        api.get("/configuracion-admin/sucursales"),
      ]);
      setCostos(costosRes.data.costos || []);
      setSucursales(sucursalesRes.data.sucursales || []);
    } catch {
      setMensaje("No se pudo cargar la configuracion.");
    }
  }

  function nombreCosto(costo) {
    const nombres = {
      mano_obra_hora: "Mano de obra por hora",
      gas: "Gas",
      kwh_luz: "Luz por kWh",
    };

    return nombres[costo.nombre] || costo.nombre;
  }

  function cambiarCosto(id, valor) {
    setCostos((actuales) =>
      actuales.map((costo) =>
        costo.id === id ? { ...costo, valor } : costo,
      ),
    );
  }

  async function guardarCosto(costo) {
    try {
      await api.put(`/configuracion-admin/costos/${costo.id}`, {
        valor: costo.valor,
        unidad: costo.unidad,
      });
      setMensaje("Costo actualizado.");
      cargarDatos();
    } catch {
      setMensaje("No se pudo actualizar el costo.");
    }
  }

  function limpiarSucursal() {
    setSucursalForm(sucursalVacia);
    setEditandoSucursal(null);
  }

  function editarSucursal(sucursal) {
    setEditandoSucursal(sucursal.id);
    setSucursalForm({
      nombre: sucursal.nombre || "",
      direccion: sucursal.direccion || "",
      telefono: sucursal.telefono || "",
    });
  }

  async function guardarSucursal(e) {
    e.preventDefault();

    try {
      if (editandoSucursal) {
        await api.put(`/configuracion-admin/sucursales/${editandoSucursal}`, sucursalForm);
        setMensaje("Sucursal actualizada.");
      } else {
        await api.post("/configuracion-admin/sucursales", sucursalForm);
        setMensaje("Sucursal creada.");
      }

      limpiarSucursal();
      cargarDatos();
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo guardar la sucursal.");
    }
  }

  async function eliminarSucursal(id) {
    if (!confirm("Deseas desactivar esta sucursal?")) return;

    try {
      await api.delete(`/configuracion-admin/sucursales/${id}`);
      setMensaje("Sucursal desactivada.");
      cargarDatos();
    } catch {
      setMensaje("No se pudo desactivar la sucursal.");
    }
  }

  return (
    <div>
      {mensaje && <div className="info-message">{mensaje}</div>}

      <div className="panel-card">
        <h2>Costos de receta</h2>
        <p>Ajusta los valores usados para calcular mano de obra, gas y luz.</p>

        <div className="settings-grid">
          {costos.map((costo) => (
            <div key={costo.id} className="settings-item">
              <label>
                {nombreCosto(costo)}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costo.valor}
                  onChange={(e) => cambiarCosto(costo.id, e.target.value)}
                />
              </label>
              <span>{costo.unidad || "unidad"}</span>
              <button className="btn btn-primary" onClick={() => guardarCosto(costo)}>
                Guardar
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-card">
        <h2>{editandoSucursal ? "Editar sucursal" : "Crear sucursal"}</h2>

        <form className="admin-form" onSubmit={guardarSucursal}>
          <div className="form-grid">
            <label>
              Nombre
              <input
                value={sucursalForm.nombre}
                onChange={(e) =>
                  setSucursalForm({ ...sucursalForm, nombre: e.target.value })
                }
                required
              />
            </label>

            <label>
              Direccion
              <input
                value={sucursalForm.direccion}
                onChange={(e) =>
                  setSucursalForm({ ...sucursalForm, direccion: e.target.value })
                }
              />
            </label>

            <label>
              Telefono
              <input
                value={sucursalForm.telefono}
                onChange={(e) =>
                  setSucursalForm({ ...sucursalForm, telefono: e.target.value })
                }
              />
            </label>
          </div>

          <div className="action-row">
            <button className="btn btn-primary">
              {editandoSucursal ? "Actualizar sucursal" : "Crear sucursal"}
            </button>
            {editandoSucursal && (
              <button type="button" className="btn btn-outline" onClick={limpiarSucursal}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="panel-card">
        <h2>Sucursales</h2>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Direccion</th>
                <th>Telefono</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sucursales.map((sucursal) => (
                <tr key={sucursal.id}>
                  <td>{sucursal.nombre}</td>
                  <td>{sucursal.direccion || "-"}</td>
                  <td>{sucursal.telefono || "-"}</td>
                  <td>
                    <button className="mini-button" onClick={() => editarSucursal(sucursal)}>
                      Editar
                    </button>
                    <button
                      className="mini-button danger"
                      onClick={() => eliminarSucursal(sucursal.id)}
                    >
                      Desactivar
                    </button>
                  </td>
                </tr>
              ))}
              {sucursales.length === 0 && (
                <tr>
                  <td colSpan="4">No hay sucursales registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
