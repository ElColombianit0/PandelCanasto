import { useEffect, useState } from "react";
import api from "../../api/api.js";

const recetaVacia = {
  id: null,
  producto_id: "",
  nombre: "",
  descripcion: "",
  unidades_resultantes: 1,
  tiempo_mano_obra_horas: 0,
  consumo_luz_kwh: 0,
  consumo_gas: 0,
  margen_sugerido_porcentaje: 30,
  auto_preparar: false,
  ingredientes: [],
};

export default function RecetasAdmin() {
  const [recetas, setRecetas] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [productos, setProductos] = useState([]);
  const [costosVariables, setCostosVariables] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [formReceta, setFormReceta] = useState(recetaVacia);
  const [editMode, setEditMode] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [cantidadesPreparar, setCantidadesPreparar] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarDatosBase();
    cargarRecetas();
    cargarHistorial();
  }, []);

  async function cargarDatosBase() {
    try {
      const { data } = await api.get("/recetas/datos-base");
      setInventario(data.inventario || []);
      setProductos(data.productos || []);
      const costosRes = await api.get("/configuracion-admin/costos");
      setCostosVariables(costosRes.data.costos || []);
    } catch {
      setMensaje("Error cargando datos base");
    }
  }

  async function cargarRecetas() {
    try {
      const { data } = await api.get("/recetas");
      setRecetas(data.recetas || []);
    } catch {
      setMensaje("Error cargando recetas");
    }
  }

  async function cargarHistorial() {
    try {
      const { data } = await api.get("/recetas/historial");
      setHistorial(data.historial || []);
    } catch {
      setMensaje("Error cargando historial");
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormReceta((actual) => ({
      ...actual,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function agregarIngrediente() {
    setFormReceta((actual) => ({
      ...actual,
      ingredientes: [
        ...actual.ingredientes,
        { inventario_id: "", cantidad_usada: 0, costo: 0 },
      ],
    }));
  }

  function calcularCostoIngrediente(inventarioId, cantidad) {
    const item = inventario.find((i) => i.id === Number(inventarioId));
    if (!item) return 0;

    const unidad = String(item.abreviatura || "").trim().toLowerCase();
    const cantidadNumerica = Number(cantidad || 0);
    const cantidadCosto = [
      "g",
      "gr",
      "gr.",
      "gramo",
      "gramos",
      "ml",
      "ml.",
      "mililitro",
      "mililitros",
    ].includes(unidad)
      ? cantidadNumerica / 1000
      : cantidadNumerica;

    return cantidadCosto * Number(item.costo_unitario || 0);
  }

  function handleIngredienteChange(index, field, value) {
    const ingredientes = [...formReceta.ingredientes];
    ingredientes[index] = { ...ingredientes[index], [field]: value };
    ingredientes[index].costo = calcularCostoIngrediente(
      ingredientes[index].inventario_id,
      ingredientes[index].cantidad_usada,
    );
    setFormReceta({ ...formReceta, ingredientes });
  }

  function quitarIngrediente(index) {
    const ingredientes = [...formReceta.ingredientes];
    ingredientes.splice(index, 1);
    setFormReceta({ ...formReceta, ingredientes });
  }

  function nuevaReceta() {
    setFormReceta(recetaVacia);
    setEditMode(false);
    setMensaje("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prepararPayload() {
    return {
      ...formReceta,
      producto_id: formReceta.producto_id || null,
      ingredientes: formReceta.ingredientes
        .filter((ing) => ing.inventario_id && Number(ing.cantidad_usada) > 0)
        .map((ing) => ({
          id: ing.id || null,
          inventario_id: Number(ing.inventario_id),
          cantidad_usada: Number(ing.cantidad_usada),
        })),
    };
  }

  async function guardarReceta(e) {
    e.preventDefault();
    setGuardando(true);

    try {
      const payload = prepararPayload();

      if (editMode) {
        await api.put(`/recetas/${formReceta.id}`, payload);
      } else {
        await api.post("/recetas", payload);
      }

      const mensajeExito = editMode ? "Receta actualizada" : "Receta creada";
      nuevaReceta();
      setMensaje(mensajeExito);
      await cargarRecetas();
      await cargarHistorial();
    } catch (err) {
      setMensaje(err.response?.data?.message || "Error al guardar la receta");
    } finally {
      setGuardando(false);
    }
  }

  function editarReceta(receta) {
    const ingredientesForm = (receta.ingredientes || []).map((ing) => ({
      id: ing.id,
      inventario_id: ing.inventario_id || "",
      cantidad_usada: ing.cantidad_usada || 0,
      costo: calcularCostoIngrediente(ing.inventario_id, ing.cantidad_usada),
    }));

    setFormReceta({
      id: receta.id,
      producto_id: receta.producto_id || "",
      nombre: receta.nombre || "",
      descripcion: receta.descripcion || "",
      unidades_resultantes: receta.unidades_resultantes || 1,
      tiempo_mano_obra_horas: receta.tiempo_mano_obra_horas || 0,
      consumo_luz_kwh: receta.consumo_luz_kwh || 0,
      consumo_gas: receta.consumo_gas || 0,
      margen_sugerido_porcentaje: receta.margen_sugerido_porcentaje || 30,
      auto_preparar:
        receta.auto_preparar === true ||
        receta.auto_preparar === "true" ||
        receta.auto_preparar === 1,
      ingredientes: ingredientesForm,
    });

    setEditMode(true);
    setMensaje("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarReceta(id) {
    if (!confirm("Deseas eliminar esta receta?")) return;

    try {
      await api.delete(`/recetas/${id}`);
      setMensaje("Receta eliminada");
      await cargarRecetas();
    } catch (err) {
      setMensaje(err.response?.data?.message || "Error al eliminar receta");
    }
  }

  async function prepararReceta(id) {
    const cantidad = Number(cantidadesPreparar[id] || 1);

    try {
      await api.post(`/recetas/${id}/preparar`, {
        cantidad_preparada: cantidad,
      });
      setMensaje("Receta preparada correctamente");
      await cargarDatosBase();
      await cargarRecetas();
      await cargarHistorial();
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Error al preparar receta";
      setMensaje(errorMessage);

      if (errorMessage.toLowerCase().includes("stock insuficiente")) {
        window.alert(errorMessage);
      }
    }
  }

  async function cancelarReceta(historialId) {
    if (!confirm("Deseas cancelar esta preparacion?")) return;

    try {
      await api.post(`/recetas/historial/${historialId}/cancelar`);
      setMensaje("Preparacion cancelada y stock repuesto");
      await cargarDatosBase();
      await cargarRecetas();
      await cargarHistorial();
    } catch (err) {
      setMensaje(err.response?.data?.message || "Error al cancelar preparacion");
    }
  }

  const costoIngredientes = formReceta.ingredientes.reduce(
    (acc, ing) => acc + Number(ing.costo || 0),
    0,
  );
  const costoPorNombre = (nombre) =>
    Number(costosVariables.find((costo) => costo.nombre === nombre)?.valor || 0);
  const costoManoObra =
    Number(formReceta.tiempo_mano_obra_horas || 0) * costoPorNombre("mano_obra_hora");
  const costoGas = Number(formReceta.consumo_gas || 0) * costoPorNombre("gas");
  const costoLuz = Number(formReceta.consumo_luz_kwh || 0) * costoPorNombre("kwh_luz");
  const costoVariablesEstimado = costoManoObra + costoGas + costoLuz;
  const costoTotalEstimado = costoIngredientes + costoVariablesEstimado;
  const unidades = Number(formReceta.unidades_resultantes || 1);
  const costoUnitarioEstimado =
    unidades > 0 ? costoTotalEstimado / unidades : costoTotalEstimado;
  const precioSugeridoEstimado =
    costoUnitarioEstimado +
    costoUnitarioEstimado *
      (Number(formReceta.margen_sugerido_porcentaje || 0) / 100);
  const moneda = (valor) => `$${Number(valor || 0).toLocaleString("es-CO")}`;
  const fechaBogota = (valor) => {
    if (!valor) return "";

    const texto = String(valor);
    const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);

    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}, ${match[4]}:${match[5]}`;
    }

    return new Date(valor).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
    });
  };
  const historialFiltrado = historial.filter((h) => {
    const usuario = String(h.usuario_nombre || "").toLowerCase();
    const filtro = filtroUsuario.toLowerCase();
    const fecha = h.creado_en_colombia
      ? String(h.creado_en_colombia).slice(0, 10)
      : h.creado_en
        ? String(h.creado_en).slice(0, 10)
        : "";
    return (!filtro || usuario.includes(filtro)) && (!filtroFecha || fecha === filtroFecha);
  });

  return (
    <div>
      {mensaje && <div className="info-message">{mensaje}</div>}

      <div className="panel-card">
        <div className="recipe-detail-header">
          <h2>{editMode ? "Editar receta" : "Crear receta"}</h2>
          <button type="button" className="btn btn-outline" onClick={nuevaReceta}>
            + Crear nueva receta
          </button>
        </div>

        <form onSubmit={guardarReceta} className="admin-form">
          <div className="form-grid">
            <label>
              Producto asociado
              <select
                name="producto_id"
                value={formReceta.producto_id}
                onChange={handleChange}
              >
                <option value="">Sin producto</option>
                {productos.map((producto) => (
                  <option key={producto.id} value={producto.id}>
                    {producto.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Nombre de la receta
              <input
                name="nombre"
                value={formReceta.nombre}
                onChange={handleChange}
                required
              />
            </label>

            <label className="checkbox-inline recipe-auto-check">
              <input
                type="checkbox"
                name="auto_preparar"
                checked={formReceta.auto_preparar}
                onChange={handleChange}
              />
              Auto preparar al vender
            </label>

            <label>
              Unidades resultantes
              <input
                type="number"
                min="0.01"
                step="0.01"
                name="unidades_resultantes"
                value={formReceta.unidades_resultantes}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Horas mano de obra
              <input
                type="number"
                min="0"
                step="0.01"
                name="tiempo_mano_obra_horas"
                value={formReceta.tiempo_mano_obra_horas}
                onChange={handleChange}
              />
            </label>

            <label>
              Consumo luz kWh
              <input
                type="number"
                min="0"
                step="0.01"
                name="consumo_luz_kwh"
                value={formReceta.consumo_luz_kwh}
                onChange={handleChange}
              />
            </label>

            <label>
              Consumo gas
              <input
                type="number"
                min="0"
                step="0.01"
                name="consumo_gas"
                value={formReceta.consumo_gas}
                onChange={handleChange}
              />
            </label>

            <label>
              Margen sugerido %
              <input
                type="number"
                min="0"
                step="0.01"
                name="margen_sugerido_porcentaje"
                value={formReceta.margen_sugerido_porcentaje}
                onChange={handleChange}
              />
            </label>

            <label>
              Descripcion
              <textarea
                name="descripcion"
                value={formReceta.descripcion}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className="recipe-cost-box">
            <div>
              <span>Costo ingredientes</span>
              <strong>{moneda(costoIngredientes)}</strong>
            </div>
            <div>
              <span>Mano de obra, gas y luz</span>
              <strong>{moneda(costoVariablesEstimado)}</strong>
            </div>
            <div>
              <span>Costo total receta</span>
              <strong>{moneda(costoTotalEstimado)}</strong>
            </div>
            <div>
              <span>Costo unitario estimado</span>
              <strong>{moneda(costoUnitarioEstimado)}</strong>
            </div>
            <div>
              <span>Precio sugerido estimado</span>
              <strong>{moneda(precioSugeridoEstimado)}</strong>
            </div>
          </div>

          <div className="panel-subsection">
            <h3>Ingredientes</h3>
            <button type="button" className="btn btn-outline" onClick={agregarIngrediente}>
              + Agregar ingrediente
            </button>

            {formReceta.ingredientes.map((ing, idx) => (
              <div key={`${ing.id || "nuevo"}-${idx}`} className="recipe-ingredient-row">
                <select
                  value={ing.inventario_id}
                  onChange={(e) =>
                    handleIngredienteChange(idx, "inventario_id", e.target.value)
                  }
                  required
                >
                  <option value="">Seleccionar ingrediente</option>
                  {inventario.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre} - {moneda(item.costo_unitario)} / {item.abreviatura || ""}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Cantidad usada"
                  value={ing.cantidad_usada}
                  onChange={(e) =>
                    handleIngredienteChange(idx, "cantidad_usada", e.target.value)
                  }
                  required
                />

                <span className="recipe-mini-cost">{moneda(ing.costo)}</span>

                <button
                  type="button"
                  className="mini-button danger"
                  onClick={() => quitarIngrediente(idx)}
                >
                  Quitar
                </button>
              </div>
            ))}

            {formReceta.ingredientes.length === 0 && (
              <p>No has agregado ingredientes todavia.</p>
            )}
          </div>

          <button className="btn btn-primary" disabled={guardando}>
            {guardando
              ? "Guardando..."
              : editMode
                ? "Actualizar receta"
                : "Guardar receta"}
          </button>
        </form>
      </div>

      <div className="panel-card">
        <h2>Recetas creadas</h2>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Receta</th>
                <th>Producto</th>
                <th>Costo unitario</th>
                <th>Precio sugerido</th>
                <th>Auto</th>
                <th>Preparar</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {recetas.map((receta) => (
                <tr key={receta.id}>
                  <td>{receta.nombre}</td>
                  <td>{receta.producto_nombre || "Sin producto"}</td>
                  <td>{moneda(receta.costo_unitario)}</td>
                  <td>{moneda(receta.precio_sugerido)}</td>
                  <td>{receta.auto_preparar ? "Sí" : "No"}</td>
                  <td>
                    {receta.auto_preparar ? (
                      <span className="status-pill">Se prepara al vender</span>
                    ) : (
                      <div className="recipe-actions">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={cantidadesPreparar[receta.id] || 1}
                          onChange={(e) =>
                            setCantidadesPreparar({
                              ...cantidadesPreparar,
                              [receta.id]: e.target.value,
                            })
                          }
                        />
                        <button
                          className="btn btn-success"
                          onClick={() => prepararReceta(receta.id)}
                        >
                          Preparar
                        </button>
                      </div>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-outline" onClick={() => editarReceta(receta)}>
                      Editar
                    </button>
                    <button className="btn btn-danger" onClick={() => eliminarReceta(receta.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {recetas.length === 0 && (
                <tr>
                  <td colSpan="7">No hay recetas registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h2>Historial de recetas</h2>
        <div className="recipe-filter-bar">
          <label>
            Filtrar por usuario
            <input
              type="text"
              value={filtroUsuario}
              onChange={(e) => setFiltroUsuario(e.target.value)}
            />
          </label>
          <label>
            Filtrar por fecha
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
            />
          </label>
        </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Receta</th>
                <th>Usuario</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {historialFiltrado.map((item) => (
                <tr key={item.id}>
                  <td>{item.receta_nombre}</td>
                  <td>{item.usuario_nombre}</td>
                  <td>{fechaBogota(item.creado_en_colombia || item.creado_en)}</td>
                  <td>{item.cancelada ? "Cancelada" : "Preparada"}</td>
                  <td>
                    {!item.cancelada && (
                      <button
                        className="btn btn-warning"
                        onClick={() => cancelarReceta(item.id)}
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {historialFiltrado.length === 0 && (
                <tr>
                  <td colSpan="5">No hay preparaciones registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
