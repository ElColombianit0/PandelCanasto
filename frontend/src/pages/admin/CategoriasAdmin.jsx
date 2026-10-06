import { useEffect, useState } from "react";
import api from "../../api/api.js";

export default function CategoriasAdmin() {
  const [categorias, setCategorias] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [preview, setPreview] = useState("");

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    imagen: null,
    activo: true,
  });

  useEffect(() => {
    cargarCategorias();
  }, []);

  async function cargarCategorias() {
    try {
      const { data } = await api.get("/categorias");
      setCategorias(data.categorias || []);
    } catch {
      setMensaje("No se pudieron cargar las categorías.");
    }
  }

  function limpiarForm() {
    setForm({
      nombre: "",
      descripcion: "",
      imagen: null,
      activo: true,
    });

    setPreview("");
    setEditandoId(null);
  }

  function handleChange(e) {
    const { name, value, type, checked, files } = e.target;

    if (type === "file") {
      const file = files[0];

      setForm({
        ...form,
        imagen: file,
      });

      if (file) {
        setPreview(URL.createObjectURL(file));
      }

      return;
    }

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  }

  function crearFormData() {
    const data = new FormData();

    data.append("nombre", form.nombre);
    data.append("descripcion", form.descripcion || "");
    data.append("activo", form.activo);

    if (form.imagen) {
      data.append("imagen", form.imagen);
    }

    return data;
  }

  async function guardarCategoria(e) {
    e.preventDefault();
    setMensaje("");

    try {
      const data = crearFormData();

      if (editandoId) {
        await api.put(`/categorias/${editandoId}`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMensaje("Categoría actualizada.");
      } else {
        await api.post("/categorias", data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMensaje("Categoría creada.");
      }

      limpiarForm();
      cargarCategorias();
    } catch (error) {
      setMensaje(
        error.response?.data?.message ||
          "No se pudo guardar la categoría."
      );
    }
  }

  function editarCategoria(categoria) {
    setEditandoId(categoria.id);

    setForm({
      nombre: categoria.nombre || "",
      descripcion: categoria.descripcion || "",
      imagen: null,
      activo: categoria.activo,
    });

    setPreview(categoria.imagen_url || "");
  }

  async function eliminarCategoria(id) {
    const confirmar = confirm("¿Seguro que quieres eliminar esta categoría?");
    if (!confirmar) return;

    try {
      await api.delete(`/categorias/${id}`);
      setMensaje("Categoría eliminada.");
      cargarCategorias();
    } catch (error) {
      setMensaje(
        error.response?.data?.message ||
          "No se pudo eliminar la categoría."
      );
    }
  }

  function urlImagen(url) {
    if (!url) return "/logo.png";
    if (url.startsWith("blob:")) return url;
    if (url.startsWith("http")) return url;
    return url;
  }

  return (
    <div>
      <div className="panel-card">
        <h2>{editandoId ? "Editar categoría" : "Crear categoría"}</h2>

        <p>
          La imagen de la categoría se usará en el menú público y en los bloques
          visuales de la página principal.
        </p>

        {mensaje && <div className="info-message">{mensaje}</div>}

        <form className="admin-form" onSubmit={guardarCategoria}>
          <div className="form-grid">
            <label>
              Nombre
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Bebidas"
                required
              />
            </label>

            <label>
              Descripción
              <input
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                placeholder="Bebidas calientes y frías"
              />
            </label>

            <label>
              Imagen de categoría
              <input
                type="file"
                name="imagen"
                accept="image/*"
                onChange={handleChange}
              />
            </label>
          </div>

          {preview && (
            <div>
              <p className="small-label">Vista previa</p>
              <img
                src={urlImagen(preview)}
                className="category-preview-large"
                alt="Categoría"
              />
            </div>
          )}

          {editandoId && (
            <label className="checkbox-inline">
              <input
                type="checkbox"
                name="activo"
                checked={form.activo}
                onChange={handleChange}
              />
              Categoría activa
            </label>
          )}

          <div className="action-row">
            <button className="btn btn-primary">
              {editandoId ? "Actualizar categoría" : "Crear categoría"}
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
        <h2>Categorías registradas</h2>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {categorias.map((categoria) => (
                <tr key={categoria.id}>
                  <td>
                    <img
                      src={urlImagen(categoria.imagen_url)}
                      className="product-preview-img"
                      alt={categoria.nombre}
                    />
                  </td>

                  <td>{categoria.nombre}</td>
                  <td>{categoria.descripcion || "Sin descripción"}</td>
                  <td>{categoria.activo ? "Sí" : "No"}</td>

                  <td>
                    <button
                      className="mini-button"
                      onClick={() => editarCategoria(categoria)}
                    >
                      Editar
                    </button>

                    <button
                      className="mini-button danger"
                      onClick={() => eliminarCategoria(categoria.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}

              {categorias.length === 0 && (
                <tr>
                  <td colSpan="5">No hay categorías creadas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
