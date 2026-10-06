import { useEffect, useState } from "react";
import api from "../../api/api.js";

export default function ProductosAdmin() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [preview, setPreview] = useState("");
  const [categoriaBusqueda, setCategoriaBusqueda] = useState("");
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const [form, setForm] = useState({
    categorias: [],
    nombre: "",
    descripcion: "",
    precio_venta: "",
    descuento_porcentaje: 0,
    imagen: null,
    visible_menu: true,
    disponible_venta: true,
    activo: true,
    es_promocion: false,
    producto_base_id: "",
    cantidad_base: 1,
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    await Promise.all([
      cargarProductos(),
      cargarCategorias(),
    ]);
  }

  async function cargarProductos() {
    try {
      const { data } = await api.get("/productos");
      setProductos(data.productos || []);
    } catch {
      setMensaje("No se pudieron cargar los productos.");
    }
  }

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
      categorias: [],
      nombre: "",
      descripcion: "",
      precio_venta: "",
      descuento_porcentaje: 0,
      imagen: null,
      visible_menu: true,
      disponible_venta: true,
      activo: true,
      es_promocion: false,
      producto_base_id: "",
      cantidad_base: 1,
    });

    setPreview("");
    setEditandoId(null);
    setCategoriaBusqueda("");
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

    data.append("categorias", JSON.stringify(form.categorias || []));
    data.append("nombre", form.nombre);
    data.append("descripcion", form.descripcion || "");
    data.append("precio_venta", form.precio_venta);
    data.append("descuento_porcentaje", form.descuento_porcentaje || 0);
    data.append("visible_menu", form.visible_menu);
    data.append("disponible_venta", form.disponible_venta);
    data.append("activo", form.activo);
    data.append("es_promocion", form.es_promocion || false);
    data.append("producto_base_id", form.producto_base_id || "");
    data.append("cantidad_base", form.cantidad_base || 1);

    if (form.imagen) {
      data.append("imagen", form.imagen);
    }

    return data;
  }

  async function guardarProducto(e) {
    e.preventDefault();
    setMensaje("");

    try {
      const data = crearFormData();

      if (editandoId) {
        await api.put(`/productos/${editandoId}`, data, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        setMensaje("Producto actualizado correctamente.");
      } else {
        await api.post("/productos", data, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        setMensaje("Producto creado correctamente.");
      }

      limpiarForm();
      cargarProductos();
    } catch (error) {
      setMensaje(
        error.response?.data?.message ||
          "No se pudo guardar el producto."
      );
    }
  }

  function editarProducto(producto) {
    setEditandoId(producto.id);

    setForm({
      categorias: (producto.categorias || []).map((cat) => cat.id),
      nombre: producto.nombre || "",
      descripcion: producto.descripcion || "",
      precio_venta: producto.precio_venta || "",
      descuento_porcentaje: producto.descuento_porcentaje || 0,
      imagen: null,
      visible_menu: producto.visible_menu,
      disponible_venta: producto.disponible_venta,
      activo: producto.activo,
      es_promocion: producto.es_promocion || false,
      producto_base_id: producto.producto_base_id || "",
      cantidad_base: producto.cantidad_base || 1,
    });

    setPreview(producto.imagen_url || "");
    setCategoriaBusqueda("");
  }

  function agregarCategoria(categoriaId) {
    const id = Number(categoriaId);

    if (!id || (form.categorias || []).includes(id)) return;

    setForm((prev) => ({
      ...prev,
      categorias: [...(prev.categorias || []), id],
    }));
    setCategoriaBusqueda("");
  }

  function quitarCategoria(categoriaId) {
    setForm((prev) => ({
      ...prev,
      categorias: (prev.categorias || []).filter((id) => id !== categoriaId),
    }));
  }

  async function eliminarProducto(id) {
    const confirmar = confirm("¿Seguro que quieres eliminar este producto?");

    if (!confirmar) return;

    try {
      await api.delete(`/productos/${id}`);
      setMensaje("Producto eliminado correctamente.");
      cargarProductos();
    } catch {
      setMensaje("No se pudo eliminar el producto.");
    }
  }

  function urlImagen(url) {
    if (!url) return "/logo.png";

    if (url.startsWith("blob:")) return url;

    if (url.startsWith("http")) return url;

    return url;
  }

  const categoriasFiltradas = categorias.filter((categoria) =>
    categoria.nombre.toLowerCase().includes(categoriaBusqueda.toLowerCase())
  );

  const categoriasSeleccionadas = categorias.filter((categoria) =>
    (form.categorias || []).includes(categoria.id)
  );

  const productosFiltrados = productos.filter((producto) => {
    const coincideNombre = producto.nombre
      .toLowerCase()
      .includes(filtroNombre.toLowerCase());
    const coincideCategoria =
      !filtroCategoria ||
      (producto.categorias || []).some(
        (categoria) => String(categoria.id) === String(filtroCategoria),
      );

    return coincideNombre && coincideCategoria;
  });

  return (
    <div>
      <div className="panel-card">
        <h2>{editandoId ? "Editar producto" : "Crear producto"}</h2>

        <p>
          Puedes crear productos, subir foto desde tu computador, asignar
          categoría, definir precio, descuento y controlar si aparece en el menú
          público o en ventas.
        </p>

        {mensaje && <div className="info-message">{mensaje}</div>}

        <form className="admin-form" onSubmit={guardarProducto}>
          <div className="form-grid">
            <div className="multi-category-box">
              <strong>Categorias</strong>

              <div className="category-search-select">
                <input
                  type="search"
                  value={categoriaBusqueda}
                  onChange={(e) => setCategoriaBusqueda(e.target.value)}
                  placeholder="Buscar categoria..."
                />

                <select value="" onChange={(e) => agregarCategoria(e.target.value)}>
                  <option value="">Seleccionar categoria</option>
                  {categoriasFiltradas.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="selected-category-chips">
                {categoriasSeleccionadas.map((categoria) => (
                  <button
                    type="button"
                    key={categoria.id}
                    onClick={() => quitarCategoria(categoria.id)}
                    title="Quitar categoria"
                  >
                    {categoria.nombre} x
                  </button>
                ))}

                {categoriasSeleccionadas.length === 0 && (
                  <span>Sin categorias seleccionadas</span>
                )}
              </div>
            </div>

            <label>
              Nombre
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Roll New York"
                required
              />
            </label>

            <label>
              Precio de venta
              <input
                type="number"
                name="precio_venta"
                value={form.precio_venta}
                onChange={handleChange}
                placeholder="12000"
                required
              />
            </label>

            <label>
              Descuento %
              <input
                type="number"
                name="descuento_porcentaje"
                value={form.descuento_porcentaje}
                onChange={handleChange}
                placeholder="0"
              />
            </label>

            <label>
              Imagen del producto
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
              <img src={urlImagen(preview)} className="product-preview-large" />
            </div>
          )}

          <label>
            Descripción
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              placeholder="Descripción del producto"
            />
          </label>

          <div className="checkbox-row">
            <label>
              <input
                type="checkbox"
                name="visible_menu"
                checked={form.visible_menu}
                onChange={handleChange}
              />
              Visible en menú público
            </label>

            <label>
              <input
                type="checkbox"
                name="disponible_venta"
                checked={form.disponible_venta}
                onChange={handleChange}
              />
              Disponible para venta
            </label>

            {editandoId && (
              <label>
                <input
                  type="checkbox"
                  name="activo"
                  checked={form.activo}
                  onChange={handleChange}
                />
                Producto activo
              </label>
            )}
          </div>

          <div className="action-row">
            <button className="btn btn-primary">
              {editandoId ? "Actualizar producto" : "Guardar producto"}
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
        <h2>Productos registrados</h2>

        <div className="sales-filter-bar">
          <label>
            Buscar producto
            <input
              type="search"
              value={filtroNombre}
              onChange={(e) => setFiltroNombre(e.target.value)}
              placeholder="Nombre del producto"
            />
          </label>

          <label>
            Filtrar categoría
            <select
              className="nice-select"
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>Categoría</th>
                <th>Nombre</th>
                <th>Precio</th>
                <th>Descuento</th>
                <th>Menú</th>
                <th>Venta</th>
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {productosFiltrados.map((producto) => (
                <tr key={producto.id}>
                  <td>
                    <img
                      src={urlImagen(producto.imagen_url)}
                      className="product-preview-img"
                    />
                  </td>

                  <td>{(producto.categorias || []).map((c) => c.nombre).join(", ") || "Sin categoría"}</td>

                  <td>{producto.nombre}</td>

                  <td>
                    ${Number(producto.precio_venta).toLocaleString("es-CO")}
                  </td>

                  <td>{producto.descuento_porcentaje}%</td>

                  <td>{producto.visible_menu ? "Sí" : "No"}</td>

                  <td>{producto.disponible_venta ? "Sí" : "No"}</td>

                  <td>{producto.activo ? "Sí" : "No"}</td>

                  <td>
                    <button
                      className="mini-button"
                      onClick={() => editarProducto(producto)}
                    >
                      Editar
                    </button>

                    <button
                      className="mini-button danger"
                      onClick={() => eliminarProducto(producto.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}

              {productosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="9">No hay productos cargados todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
