import { useEffect, useState } from "react";
import api from "../../api/api.js";

export default function MesasAdmin() {
  const [mesas, setMesas] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [editandoId, setEditandoId] = useState(null);

  const [form, setForm] = useState({
    nombre: "",
    capacidad: "",
    estado: "LIBRE",
  });

  useEffect(() => {
    cargarMesas();
  }, []);

  async function cargarMesas() {
    try {
      const { data } = await api.get("/mesas");
      setMesas(data.mesas || []);
    } catch {
      setMesas([]);
      setMensaje("No se pudieron cargar las mesas.");
    }
  }

  function limpiarForm() {
    setForm({
      nombre: "",
      capacidad: "",
      estado: "LIBRE",
    });
    setEditandoId(null);
  }

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function guardarMesa(e) {
    e.preventDefault();
    setMensaje("");

    try {
      if (editandoId) {
        await api.put(`/mesas/${editandoId}`, form);
        setMensaje("Mesa actualizada correctamente.");
      } else {
        await api.post("/mesas", form);
        setMensaje("Mesa creada correctamente.");
      }

      limpiarForm();
      cargarMesas();
    } catch (error) {
      setMensaje(
        error.response?.data?.message ||
          "No se pudo guardar la mesa."
      );
    }
  }

  function editarMesa(mesa) {
    setEditandoId(mesa.id);
    setForm({
      nombre: mesa.nombre || "",
      capacidad: mesa.capacidad || "",
      estado: mesa.estado || "LIBRE",
    });
  }

  async function eliminarMesa(id) {
    const confirmar = confirm("¿Seguro que quieres eliminar esta mesa?");

    if (!confirmar) return;

    try {
      await api.delete(`/mesas/${id}`);
      setMensaje("Mesa eliminada correctamente.");
      cargarMesas();
    } catch (error) {
      setMensaje(
        error.response?.data?.message ||
          "No se pudo eliminar la mesa."
      );
    }
  }

  return (
    <div>
      <div className="panel-card">
        <h2>{editandoId ? "Editar mesa" : "Crear mesa"}</h2>

        <p>
          Puedes cambiar el nombre, capacidad o estado de la mesa. Si una mesa
          tiene un pedido abierto no podrá eliminarse.
        </p>

        {mensaje && <div className="info-message">{mensaje}</div>}

        <form className="admin-form" onSubmit={guardarMesa}>
          <div className="form-grid">
            <label>
              Nombre de mesa
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Mesa 1"
                required
              />
            </label>

            <label>
              Capacidad
              <input
                type="number"
                name="capacidad"
                value={form.capacidad}
                onChange={handleChange}
                placeholder="4"
              />
            </label>

            <label>
              Estado
              <select
                name="estado"
                value={form.estado}
                onChange={handleChange}
              >
                <option value="LIBRE">Libre</option>
                <option value="RESERVADA">Reservada</option>
                <option value="INACTIVA">Inactiva</option>
              </select>
            </label>
          </div>

          <div className="action-row">
            <button className="btn btn-primary">
              {editandoId ? "Actualizar mesa" : "Guardar mesa"}
            </button>

            {editandoId && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={limpiarForm}
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="panel-card">
        <h2>Mesas registradas</h2>

        <div className="mesas-grid">
          {mesas.map((mesa) => (
            <div key={mesa.id} className="mesa-card">
              <strong>{mesa.nombre}</strong>
              <span>{mesa.estado}</span>
              <p>Capacidad: {mesa.capacidad || "No definida"}</p>

              <div className="action-row">
                <button
                  className="mini-button"
                  onClick={() => editarMesa(mesa)}
                >
                  Editar
                </button>

                <button
                  className="mini-button danger"
                  onClick={() => eliminarMesa(mesa.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}

          {mesas.length === 0 && <p>No hay mesas creadas todavía.</p>}
        </div>
      </div>
    </div>
  );
}
