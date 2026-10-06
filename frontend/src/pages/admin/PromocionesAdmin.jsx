import { useEffect, useState } from "react";
import api from "../../api/api.js";

const inicial = {
  nombre: "",
  precio_venta: "",
  componentes: [{ componente_producto_id: "", cantidad: 1, busqueda: "" }],
};

export default function PromocionesAdmin() {
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(inicial);
  const [editandoId, setEditandoId] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarProductos();
  }, []);

  async function cargarProductos() {
    try {
      const { data } = await api.get("/productos");
      setProductos(data.productos || []);
    } catch {
      setMensaje("No se pudieron cargar los productos.");
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function cambiarComponente(index, campo, valor) {
    const componentes = [...form.componentes];
    componentes[index] = { ...componentes[index], [campo]: valor };
    setForm((prev) => ({ ...prev, componentes }));
  }

  function agregarComponente() {
    setForm((prev) => ({
      ...prev,
      componentes: [
        ...prev.componentes,
        { componente_producto_id: "", cantidad: 1, busqueda: "" },
      ],
    }));
  }

  function quitarComponente(index) {
    setForm((prev) => ({
      ...prev,
      componentes: prev.componentes.filter((_, idx) => idx !== index),
    }));
  }

  async function guardarPromocion(e) {
    e.preventDefault();
    setMensaje("");

    const componentesValidos = form.componentes.filter(
      (item) => item.componente_producto_id && Number(item.cantidad || 0) > 0,
    );

    if (componentesValidos.length === 0) {
      setMensaje("Agrega al menos un producto al combo.");
      return;
    }

    try {
      const data = new FormData();
      data.append("nombre", form.nombre);
      data.append("descripcion", "Promocion / combo");
      data.append("precio_venta", form.precio_venta);
      data.append("descuento_porcentaje", 0);
      data.append("visible_menu", false);
      data.append("disponible_venta", true);
      data.append("activo", true);
      data.append("categorias", JSON.stringify([]));
      data.append("es_promocion", true);
      data.append("producto_base_id", componentesValidos[0].componente_producto_id);
      data.append("cantidad_base", componentesValidos[0].cantidad);
      data.append("componentes", JSON.stringify(componentesValidos));

      if (editandoId) {
        await api.put(`/productos/${editandoId}`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/productos", data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setForm(inicial);
      setEditandoId(null);
      setMensaje(editandoId ? "Promocion actualizada correctamente." : "Promocion creada correctamente.");
      await cargarProductos();
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo guardar la promocion.");
    }
  }

  async function eliminarPromocion(id) {
    if (!confirm("Seguro que quieres eliminar esta promocion?")) return;

    try {
      await api.delete(`/productos/${id}`);
      setMensaje("Promocion eliminada.");
      await cargarProductos();
    } catch {
      setMensaje("No se pudo eliminar la promocion.");
    }
  }

  function editarPromocion(promo) {
    const componentes = promo.componentes?.length
      ? promo.componentes
      : [
          {
            componente_producto_id: promo.producto_base_id,
            cantidad: promo.cantidad_base || 1,
            busqueda: "",
          },
        ].filter((item) => item.componente_producto_id);

    setEditandoId(promo.id);
    setForm({
      nombre: promo.nombre || "",
      precio_venta: promo.precio_venta || "",
      componentes: componentes.map((item) => ({
        componente_producto_id: item.componente_producto_id || "",
        cantidad: item.cantidad || 1,
        busqueda: "",
      })),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(inicial);
  }

  const productosBase = productos.filter((producto) => !producto.es_promocion);
  const promociones = productos.filter((producto) => producto.es_promocion);
  const moneda = (valor) => `$${Number(valor || 0).toLocaleString("es-CO")}`;

  return (
    <div>
      {mensaje && <div className="info-message">{mensaje}</div>}

      <div className="panel-card">
        <h2>{editandoId ? "Editar promocion o combo" : "Crear promocion o combo"}</h2>

        <form className="admin-form" onSubmit={guardarPromocion}>
          <div className="form-grid">
            <label>
              Nombre
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Combo desayuno"
                required
              />
            </label>

            <label>
              Precio de venta
              <input
                type="number"
                min="0"
                step="1"
                name="precio_venta"
                value={form.precio_venta}
                onChange={handleChange}
                required
              />
            </label>
          </div>

          <div className="panel-subsection">
            <h3>Productos del combo</h3>

            {form.componentes.map((item, index) => (
              <div className="combo-component-row" key={index}>
                <input
                  type="search"
                  value={item.busqueda || ""}
                  onChange={(e) => cambiarComponente(index, "busqueda", e.target.value)}
                  placeholder="Buscar producto..."
                />

                <select
                  className="nice-select"
                  value={item.componente_producto_id}
                  onChange={(e) =>
                    cambiarComponente(index, "componente_producto_id", e.target.value)
                  }
                  required
                >
                  <option value="">Seleccionar producto</option>
                  {productosBase
                    .filter((producto) =>
                      producto.nombre
                        .toLowerCase()
                        .includes(String(item.busqueda || "").toLowerCase()),
                    )
                    .map((producto) => (
                      <option key={producto.id} value={producto.id}>
                        {producto.nombre} - {moneda(producto.precio_venta)}
                      </option>
                    ))}
                </select>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.cantidad}
                  onChange={(e) => cambiarComponente(index, "cantidad", e.target.value)}
                  required
                />

                <button
                  type="button"
                  className="mini-button danger"
                  onClick={() => quitarComponente(index)}
                  disabled={form.componentes.length === 1}
                >
                  Quitar
                </button>
              </div>
            ))}

            <button type="button" className="btn btn-outline" onClick={agregarComponente}>
              + Agregar producto
            </button>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary">
              {editandoId ? "Actualizar promocion" : "Guardar promocion"}
            </button>
            {editandoId && (
              <button type="button" className="btn btn-outline" onClick={cancelarEdicion}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="panel-card">
        <h2>Promociones y combos registrados</h2>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Componentes</th>
                <th>Precio</th>
                <th>Ahorro estimado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {promociones.map((promo) => {
                const componentes = promo.componentes?.length
                  ? promo.componentes
                  : [
                      {
                        producto_nombre: promo.producto_base_nombre,
                        cantidad: promo.cantidad_base,
                        componente_producto_id: promo.producto_base_id,
                      },
                    ].filter((item) => item.componente_producto_id);

                const precioNormal = componentes.reduce((acc, item) => {
                  const base = productos.find(
                    (producto) => producto.id === item.componente_producto_id,
                  );
                  return acc + Number(base?.precio_venta || 0) * Number(item.cantidad || 1);
                }, 0);
                const ahorro = precioNormal - Number(promo.precio_venta || 0);

                return (
                  <tr key={promo.id}>
                    <td>{promo.nombre}</td>
                    <td>
                      {componentes
                        .map((item) => `${item.producto_nombre} x${Number(item.cantidad || 1)}`)
                        .join(", ") || "Sin componentes"}
                    </td>
                    <td>{moneda(promo.precio_venta)}</td>
                    <td>{moneda(Math.max(ahorro, 0))}</td>
                    <td>
                      <button
                        className="mini-button"
                        onClick={() => editarPromocion(promo)}
                      >
                        Editar
                      </button>
                      <button
                        className="mini-button danger"
                        onClick={() => eliminarPromocion(promo.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}

              {promociones.length === 0 && (
                <tr>
                  <td colSpan="5">No hay promociones creadas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
