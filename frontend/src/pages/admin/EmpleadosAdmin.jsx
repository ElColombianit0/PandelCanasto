import { useEffect, useState } from "react";
import api from "../../api/api.js";

export default function EmpleadosAdmin() {
  const [empleados, setEmpleados] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [editandoId, setEditandoId] = useState(null);

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    documento: "",
    password: "",
    activo: true,
    sucursal_id: "",
  });

  useEffect(() => {
    cargarEmpleados();
    cargarSucursales();
  }, []);

  async function cargarEmpleados() {
    try {
      const { data } = await api.get("/usuarios/empleados");
      setEmpleados(data.empleados || []);
    } catch {
      setMensaje("No se pudieron cargar los empleados.");
    }
  }

  async function cargarSucursales() {
    try {
      const { data } = await api.get("/configuracion-admin/sucursales");
      setSucursales(data.sucursales || []);
    } catch {
      setSucursales([]);
    }
  }

  function limpiarForm() {
    setForm({
      nombre: "",
      email: "",
      documento: "",
      password: "",
      activo: true,
      sucursal_id: "",
    });
    setEditandoId(null);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  }

  async function guardarEmpleado(e) {
    e.preventDefault();
    setMensaje("");

    try {
      if (editandoId) {
        await api.put(`/usuarios/empleados/${editandoId}`, form);
        setMensaje("Empleado actualizado correctamente.");
      } else {
        await api.post("/usuarios/empleados", form);
        setMensaje("Empleado creado correctamente.");
      }

      limpiarForm();
      cargarEmpleados();
    } catch (error) {
      setMensaje(
        error.response?.data?.message ||
          "No se pudo guardar el empleado."
      );
    }
  }

  function editarEmpleado(empleado) {
    setEditandoId(empleado.id);
    setForm({
      nombre: empleado.nombre || "",
      email: empleado.email || "",
      documento: empleado.documento || "",
      password: "",
      activo: empleado.activo,
      sucursal_id: empleado.sucursal_id || "",
    });
  }

  async function eliminarEmpleado(id) {
    const confirmar = confirm("¿Seguro que quieres desactivar este empleado?");

    if (!confirmar) return;

    try {
      await api.delete(`/usuarios/empleados/${id}`);
      setMensaje("Empleado desactivado.");
      cargarEmpleados();
    } catch {
      setMensaje("No se pudo desactivar el empleado.");
    }
  }

  return (
    <div>
      <div className="panel-card">
        <h2>{editandoId ? "Editar empleado" : "Crear empleado"}</h2>

        <p>
          Los empleados podrán iniciar sesión usando su número de documento.
        </p>

        {mensaje && <div className="info-message">{mensaje}</div>}

        <form className="admin-form" onSubmit={guardarEmpleado}>
          <div className="form-grid">
            <label>
              Nombre
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Documento
              <input
                name="documento"
                value={form.documento}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Correo opcional
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
              />
            </label>

            <label>
              Contraseña {editandoId && "(dejar vacío para no cambiar)"}
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required={!editandoId}
              />
            </label>
            <label>
              Sucursal
              <select
                name="sucursal_id"
                value={form.sucursal_id}
                onChange={handleChange}
              >
                <option value="">Sin sucursal</option>
                {sucursales.map((sucursal) => (
                  <option key={sucursal.id} value={sucursal.id}>
                    {sucursal.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {editandoId && (
            <label className="checkbox-inline">
              <input
                type="checkbox"
                name="activo"
                checked={form.activo}
                onChange={handleChange}
              />
              Usuario activo
            </label>
          )}

          <div className="action-row">
            <button className="btn btn-primary">
              {editandoId ? "Actualizar empleado" : "Crear empleado"}
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
        <h2>Empleados registrados</h2>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Correo</th>
                <th>Sucursal</th>
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {empleados.map((empleado) => (
                <tr key={empleado.id}>
                  <td>{empleado.nombre}</td>
                  <td>{empleado.documento}</td>
                  <td>{empleado.email || "Sin correo"}</td>
                  <td>{empleado.sucursal_nombre || "Sin sucursal"}</td>
                  <td>{empleado.activo ? "Sí" : "No"}</td>
                  <td>
                    <button
                      className="mini-button"
                      onClick={() => editarEmpleado(empleado)}
                    >
                      Editar
                    </button>

                    <button
                      className="mini-button danger"
                      onClick={() => eliminarEmpleado(empleado.id)}
                    >
                      Desactivar
                    </button>
                  </td>
                </tr>
              ))}

              {empleados.length === 0 && (
                <tr>
                  <td colSpan="6">No hay empleados creados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
