import { useEffect, useState } from "react";
import api from "../../api/api.js";

export default function InventarioAdmin() {
  const [inventario, setInventario] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [productos, setProductos] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [historialCostos, setHistorialCostos] = useState([]);
  const [itemHistorial, setItemHistorial] = useState(null);
  const [entradaRapida, setEntradaRapida] = useState({
    inventario_id: "",
    nombre: "",
    cantidad: "",
    costo_unitario: "",
    motivo: "",
  });

  const [filtros, setFiltros] = useState({
    categoria_id: "",
    bajo_stock: false,
    buscar: "",
  });

  const [form, setForm] = useState({
    categoria_id: "",
    unidad_medida_id: "",
    nombre: "",
    descripcion: "",
    cantidad_actual: 0,
    stock_minimo: 0,
    costo_unitario: 0,
    descontar_en_venta: false,
    producto_venta_id: "",
    motivo: "",
  });

  const [categoriaNueva, setCategoriaNueva] = useState("");

  useEffect(() => {
    cargarBase();
    cargarInventario();
  }, []);

  async function verHistorialCostos(item) {
  try {
    const { data } = await api.get(`/inventario/${item.id}/historial-costos`);
    setItemHistorial(item);
    setHistorialCostos(data.historial || []);
  } catch {
    setMensaje("No se pudo cargar el historial de costos.");
  }
}

  async function cargarBase() {
    try {
      const { data } = await api.get("/inventario/datos-base");
      setCategorias(data.categorias || []);
      setUnidades(data.unidades || []);
      setProductos(data.productos || []);
    } catch {
      setMensaje("No se pudieron cargar datos base.");
    }
  }

  async function cargarInventario(customFiltros = filtros) {
    try {
      const params = new URLSearchParams();

      if (customFiltros.categoria_id) {
        params.append("categoria_id", customFiltros.categoria_id);
      }

      if (customFiltros.bajo_stock) {
        params.append("bajo_stock", "true");
      }

      if (customFiltros.buscar) {
        params.append("buscar", customFiltros.buscar);
      }

      const { data } = await api.get(`/inventario?${params.toString()}`);
      setInventario(data.inventario || []);
    } catch {
      setMensaje("No se pudo cargar inventario.");
    }
  }

  function limpiarForm() {
    setForm({
      categoria_id: "",
      unidad_medida_id: "",
      nombre: "",
      descripcion: "",
      cantidad_actual: 0,
      stock_minimo: 0,
      costo_unitario: 0,
      descontar_en_venta: false,
      producto_venta_id: "",
      motivo: "",
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

  function limpiarNumeroInput(valor) {
    if (valor === null || valor === undefined || valor === "") return "";

    const numero = Number(valor);

    if (!Number.isFinite(numero)) return valor;

    return String(numero);
  }

  async function guardarInventario(e) {
    e.preventDefault();
    setMensaje("");

    try {
      if (editandoId) {
        await api.put(`/inventario/${editandoId}`, form);
        setMensaje("Inventario actualizado.");
      } else {
        await api.post("/inventario", form);
        setMensaje("Item creado.");
      }

      limpiarForm();
      cargarInventario();
    } catch (error) {
      setMensaje(
        error.response?.data?.message ||
          "No se pudo guardar el inventario."
      );
    }
  }

  function abrirEntradaRapida(item) {
    setEntradaRapida({
      inventario_id: item.id,
      nombre: item.nombre,
      cantidad: "",
      costo_unitario: limpiarNumeroInput(item.costo_unitario),
      motivo: "Compra nueva",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function guardarEntradaRapida(e) {
    e.preventDefault();
    setMensaje("");

    try {
      await api.patch(`/inventario/${entradaRapida.inventario_id}/agregar-stock`, {
        cantidad: entradaRapida.cantidad,
        costo_unitario: entradaRapida.costo_unitario,
        motivo: entradaRapida.motivo,
      });
      setEntradaRapida({
        inventario_id: "",
        nombre: "",
        cantidad: "",
        costo_unitario: "",
        motivo: "",
      });
      setMensaje("Unidades agregadas al inventario.");
      cargarInventario();
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo agregar stock.");
    }
  }

  function editarItem(item) {
    setEditandoId(item.id);

    setForm({
      categoria_id: item.categoria_id || "",
      unidad_medida_id: item.unidad_medida_id || "",
      nombre: item.nombre || "",
      descripcion: item.descripcion || "",
      cantidad_actual: limpiarNumeroInput(item.cantidad_actual),
      stock_minimo: limpiarNumeroInput(item.stock_minimo),
      costo_unitario: limpiarNumeroInput(item.costo_unitario),
      descontar_en_venta: item.descontar_en_venta || false,
      producto_venta_id: item.producto_venta_id || "",
      motivo: "",
    });
  }

  async function eliminarItem(id) {
    if (!confirm("¿Seguro que quieres eliminar este item del inventario?")) return;

    try {
      await api.delete(`/inventario/${id}`);
      setMensaje("Item eliminado.");
      cargarInventario();
    } catch {
      setMensaje("No se pudo eliminar.");
    }
  }

  async function crearCategoria(e) {
    e.preventDefault();

    if (!categoriaNueva.trim()) return;

    try {
      await api.post("/inventario/categorias", {
        nombre: categoriaNueva,
      });

      setCategoriaNueva("");
      cargarBase();
      setMensaje("Categoría de inventario creada.");
    } catch (error) {
      setMensaje(
        error.response?.data?.message ||
          "No se pudo crear la categoría."
      );
    }
  }

  function aplicarFiltros(e) {
    e.preventDefault();
    cargarInventario(filtros);
  }

  function limpiarFiltros() {
    const nuevos = {
      categoria_id: "",
      bajo_stock: false,
      buscar: "",
    };

    setFiltros(nuevos);
    cargarInventario(nuevos);
  }

  function moneda(valor) {
    return `$${Number(valor || 0).toLocaleString("es-CO")}`;
  }

  function numero(valor) {
    return Number(valor || 0).toLocaleString("es-CO");
  }

  function fechaBogota(valor) {
    if (!valor) return "";

    const texto = String(valor);
    const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);

    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}, ${match[4]}:${match[5]}`;
    }

    return new Date(valor).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
    });
  }

  return (
    <div>
      {mensaje && <div className="info-message">{mensaje}</div>}

      <div className="panel-card">
        <h2>Categorías de inventario</h2>

        <form className="inline-form" onSubmit={crearCategoria}>
          <input
            value={categoriaNueva}
            onChange={(e) => setCategoriaNueva(e.target.value)}
            placeholder="Ejemplo: Bebidas, Harinas, Lácteos"
          />

          <button className="btn btn-primary">
            Crear categoría
          </button>
        </form>
      </div>

      <div className="panel-card">
        <h2>{editandoId ? "Editar inventario" : "Agregar inventario"}</h2>

        <form className="admin-form" onSubmit={guardarInventario}>
          <div className="form-grid">
            <label>
              Categoría
              <select
                name="categoria_id"
                value={form.categoria_id}
                onChange={handleChange}
                className="nice-select"
              >
                <option value="">Sin categoría</option>

                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Unidad de medida
              <select
                name="unidad_medida_id"
                value={form.unidad_medida_id}
                onChange={handleChange}
                className="nice-select"
                required
              >
                <option value="">Seleccionar</option>

                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.abreviatura})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Nombre
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Coca Cola 400ml"
                required
              />
            </label>

            <label>
              Cantidad actual
              <input
                type="number"
                step="0.001"
                name="cantidad_actual"
                value={form.cantidad_actual}
                onChange={handleChange}
              />
            </label>

            <label>
              Stock mínimo
              <input
                type="number"
                step="0.001"
                name="stock_minimo"
                value={form.stock_minimo}
                onChange={handleChange}
              />
            </label>

            <label>
              Costo unitario
              <input
                type="number"
                step="0.01"
                name="costo_unitario"
                value={form.costo_unitario}
                onChange={handleChange}
              />
            </label>

            <label>
              Producto de venta relacionado
              <select
                name="producto_venta_id"
                value={form.producto_venta_id}
                onChange={handleChange}
                className="nice-select"
              >
                <option value="">Ninguno</option>

                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Descripción
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
            />
          </label>

          <label className="checkbox-inline">
            <input
              type="checkbox"
              name="descontar_en_venta"
              checked={form.descontar_en_venta}
              onChange={handleChange}
            />
            Descontar automáticamente cuando se venda el producto relacionado
          </label>

          {editandoId && (
            <label>
              Motivo del ajuste
              <textarea
                name="motivo"
                value={form.motivo}
                onChange={handleChange}
                placeholder="Ejemplo: compra nueva, corrección de conteo, cambio de costo"
              />
            </label>
          )}

          <div className="action-row">
            <button className="btn btn-primary">
              {editandoId ? "Actualizar" : "Guardar"}
            </button>

            {editandoId && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={limpiarForm}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {entradaRapida.inventario_id && (
        <div className="panel-card">
          <h2>Añadir unidades a {entradaRapida.nombre}</h2>

          <form className="admin-form" onSubmit={guardarEntradaRapida}>
            <div className="form-grid">
              <label>
                Cantidad a sumar
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={entradaRapida.cantidad}
                  onChange={(e) =>
                    setEntradaRapida({ ...entradaRapida, cantidad: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Costo unitario
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={entradaRapida.costo_unitario}
                  onChange={(e) =>
                    setEntradaRapida({ ...entradaRapida, costo_unitario: e.target.value })
                  }
                />
              </label>
            </div>

            <label>
              Motivo
              <textarea
                value={entradaRapida.motivo}
                onChange={(e) =>
                  setEntradaRapida({ ...entradaRapida, motivo: e.target.value })
                }
                placeholder="Ejemplo: compra nueva, proveedor, correccion de conteo"
              />
            </label>

            <div className="action-row">
              <button className="btn btn-primary">Añadir unidades</button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() =>
                  setEntradaRapida({
                    inventario_id: "",
                    nombre: "",
                    cantidad: "",
                    costo_unitario: "",
                    motivo: "",
                  })
                }
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel-card">
        <h2>Inventario</h2>

        <form className="sales-filter-bar" onSubmit={aplicarFiltros}>
          <label>
            Buscar
            <input
              value={filtros.buscar}
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  buscar: e.target.value,
                })
              }
              placeholder="Nombre..."
            />
          </label>

          <label>
            Categoría
            <select
              className="nice-select"
              value={filtros.categoria_id}
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  categoria_id: e.target.value,
                })
              }
            >
              <option value="">Todas</option>

              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={filtros.bajo_stock}
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  bajo_stock: e.target.checked,
                })
              }
            />
            Solo bajo stock
          </label>

          <div className="sales-filter-actions">
            <button className="btn btn-primary">
              Filtrar
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={limpiarFiltros}
            >
              Limpiar
            </button>
          </div>
        </form>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Stock</th>
                <th>Mínimo</th>
                <th>Unidad</th>
                <th>Costo unitario</th>
                <th>Descuento venta</th>
                <th>Producto relacionado</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {inventario.map((item) => {
                const bajo =
                  item.alerta_activa ||
                  Number(item.cantidad_actual || 0) <= Number(item.stock_minimo || 0);

                return (
                  <tr key={item.id}>
                    <td>{item.nombre}</td>
                    <td>{item.categoria_nombre || "Sin categoría"}</td>
                    <td>{numero(item.cantidad_actual)}</td>
                    <td>{numero(item.stock_minimo)}</td>
                    <td>{item.unidad_abreviatura}</td>
                    <td>{moneda(item.costo_unitario)}</td>
                    <td>{item.descontar_en_venta ? "Sí" : "No"}</td>
                    <td>{item.producto_venta_nombre || "Ninguno"}</td>
                    <td>
                      {bajo ? (
                        <span className="stock-low">Bajo stock</span>
                      ) : (
                        <span className="stock-ok">OK</span>
                      )}
                    </td>
                   <td>
                  <button
                       className="mini-button"
                        onClick={() => abrirEntradaRapida(item)}
                    >
                          Añadir
                  </button>

                  <button
                       className="mini-button"
                        onClick={() => editarItem(item)}
                    >
                          Editar
                  </button>

                      <button
                          className="mini-button"
                             onClick={() => verHistorialCostos(item)}
                       >
                      Historial
                     </button>

  <button
    className="mini-button danger"
    onClick={() => eliminarItem(item.id)}
  >
    Eliminar
  </button>
</td>
                  </tr>
                );
              })}

              {inventario.length === 0 && (
                <tr>
                  <td colSpan="10">No hay inventario registrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {itemHistorial && (
  <div className="panel-card">
    <h2>Historial de costos — {itemHistorial.nombre}</h2>

    <div className="table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Costo anterior</th>
            <th>Costo nuevo</th>
            <th>Usuario</th>
            <th>Motivo</th>
          </tr>
        </thead>

        <tbody>
          {historialCostos.map((h) => (
            <tr key={h.id}>
              <td>
                {fechaBogota(h.creado_en)}
              </td>
              <td>{moneda(h.costo_anterior)}</td>
              <td>{moneda(h.costo_nuevo)}</td>
              <td>{h.usuario_nombre || "Sistema"}</td>
              <td>{h.motivo}</td>
            </tr>
          ))}

          {historialCostos.length === 0 && (
            <tr>
              <td colSpan="5">No hay historial de costos.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
)}
    </div>
  );
}
