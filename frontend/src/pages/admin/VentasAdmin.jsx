import { useEffect, useState } from "react";
import api from "../../api/api.js";
import PagoMixto, { cantidadesPago, partesPago, montosValidos, ReciboPagos } from "../../components/PagoMixto.jsx";

export default function VentasAdmin() {
  const [ventas, setVentas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [resumen, setResumen] = useState({
    total_registros: 0,
    cantidad_validas: 0,
    cantidad_anuladas: 0,
    total_validas: 0,
    page: 1,
    limit: 20,
    total_pages: 1,
  });

  const [filtros, setFiltros] = useState({
    fecha: "",
    sucursal_id: "",
    usuario_id: "",
    page: 1,
    limit: 20,
  });

  const [ventaDetalle, setVentaDetalle] = useState(null);
  const [detalles, setDetalles] = useState([]);
  const [detallesEditables, setDetallesEditables] = useState([]);
  const [config, setConfig] = useState(null);
  const [auditoria, setAuditoria] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [motivo, setMotivo] = useState("");
  const [montosMixtos, setMontosMixtos] = useState(cantidadesPago);
  const [efectivoRecibido, setEfectivoRecibido] = useState("");

  useEffect(() => {
    cargarVentas();
  }, [filtros.page]);

  async function cargarVentas(customFiltros = filtros) {
    try {
      const params = new URLSearchParams();

      if (customFiltros.fecha) {
        params.append("fecha", customFiltros.fecha);
      }

      if (customFiltros.usuario_id) {
        params.append("usuario_id", customFiltros.usuario_id);
      }

      if (customFiltros.sucursal_id) {
        params.append("sucursal_id", customFiltros.sucursal_id);
      }

      params.append("page", customFiltros.page || 1);
      params.append("limit", customFiltros.limit || 20);

      const { data } = await api.get(`/ventas?${params.toString()}`);

      setVentas(data.ventas || []);
      setUsuarios(data.usuarios || []);
      setSucursales(data.sucursales || []);
      setResumen(data.resumen || resumen);
    } catch {
      setMensaje("No se pudieron cargar las ventas.");
    }
  }

  function aplicarFiltros(e) {
    e.preventDefault();

    const nuevos = {
      ...filtros,
      page: 1,
    };

    setFiltros(nuevos);
    cargarVentas(nuevos);
  }

  function limpiarFiltros() {
    const nuevos = {
      fecha: "",
      sucursal_id: "",
      usuario_id: "",
      page: 1,
      limit: 20,
    };

    setFiltros(nuevos);
    cargarVentas(nuevos);
  }

  function cambiarPagina(nuevaPagina) {
    if (nuevaPagina < 1) return;
    if (nuevaPagina > resumen.total_pages) return;

    setFiltros((prev) => ({
      ...prev,
      page: nuevaPagina,
    }));
  }

  async function verDetalle(id) {
    try {
      const { data } = await api.get(`/ventas/${id}`);
      const aud = await api.get(`/ventas/${id}/auditoria`);

      setVentaDetalle(data.venta);
      const partes = data.venta.pagos_desglose || [];
      setMontosMixtos({ ...cantidadesPago(), ...Object.fromEntries(partes.map((p) => [String(p.metodo_pago_id), String(p.monto)])) });
      const efectivo = partes.find((p) => /efectivo/i.test(p.metodo_pago));
      setEfectivoRecibido(efectivo ? String(Number(efectivo.monto) + Number(data.venta.cambio || 0)) : "");
      setDetalles(data.detalles || []);
      setDetallesEditables(data.detalles || []);
      setConfig(data.config || null);
      setAuditoria(aud.data.auditoria || []);
      setMotivo("");
    } catch {
      setMensaje("No se pudo cargar el detalle de la venta.");
    }
  }

  function cambiarCantidad(detalleId, nuevaCantidad) {
    setDetallesEditables((prev) =>
      prev.map((item) =>
        item.id === detalleId
          ? {
              ...item,
              cantidad: Math.max(0, Number(nuevaCantidad || 0)),
            }
          : item
      )
    );
  }

  async function guardarCorreccionProductos(e) {
    e.preventDefault();

    if (!ventaDetalle) return;

    if (!motivo.trim()) {
      setMensaje("Debes escribir el motivo de la corrección.");
      return;
    }
    if (ventaDetalle.pagos_desglose?.length > 1 && (!montosValidos(montosMixtos) || partesPago(montosMixtos).reduce((s, p) => s + Math.round(p.monto * 100), 0) !== Math.round(totalEditable * 100))) {
      setMensaje("Actualiza el reparto del pago para que coincida con el total corregido.");
      return;
    }

    try {
      await api.patch(`/ventas/${ventaDetalle.id}/detalles`, {
        motivo,
        detalles: detallesEditables,
        ...(ventaDetalle.pagos_desglose?.length > 1 ? { pagos_desglose: partesPago(montosMixtos) } : {}),
        ...(efectivoRecibido !== "" ? { efectivo_recibido: efectivoRecibido } : {}),
      });

      setMensaje("Venta corregida correctamente.");
      await verDetalle(ventaDetalle.id);
      cargarVentas();
    } catch (error) {
      setMensaje(
        error.response?.data?.message ||
          "No se pudo corregir la venta."
      );
    }
  }

  async function anularVenta() {
    if (!ventaDetalle) return;

    const motivoAnulacion = prompt("Motivo de anulación:");

    if (!motivoAnulacion) return;

    try {
      await api.patch(`/ventas/${ventaDetalle.id}/anular`, {
        motivo: motivoAnulacion,
      });

      setMensaje("Venta anulada.");
      setVentaDetalle(null);
      setDetalles([]);
      setDetallesEditables([]);
      cargarVentas();
    } catch (error) {
      setMensaje(
        error.response?.data?.message ||
          "No se pudo anular la venta."
      );
    }
  }

  function imprimir() {
    window.print();
  }

  function moneda(valor) {
    return `$${Number(valor || 0).toLocaleString("es-CO")}`;
  }

  function fecha(valor) {
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

  const subtotalEditable = detallesEditables.reduce((acc, item) => {
    const precio = Number(item.precio_unitario || 0);
    const descuento = Number(item.descuento_porcentaje || 0);
    const cantidad = Number(item.cantidad || 0);
    const precioConDescuento = precio - precio * (descuento / 100);

    return acc + precioConDescuento * cantidad;
  }, 0);

  const propinaEditable = Number((subtotalEditable *
    (Number(ventaDetalle?.propina_porcentaje || 0) / 100)).toFixed(2));

  const totalEditable = Number((subtotalEditable + propinaEditable).toFixed(2));

  return (
    <div>
      {mensaje && <div className="info-message">{mensaje}</div>}

      <div className="panel-card no-print">
        <h2>Administrar ventas</h2>

        <form className="sales-filter-bar" onSubmit={aplicarFiltros}>
          <label>
            Día específico
            <input
              type="date"
              value={filtros.fecha}
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  fecha: e.target.value,
                })
              }
            />
          </label>

          <label>
            Sucursal
            <select
              className="nice-select"
              value={filtros.sucursal_id}
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  sucursal_id: e.target.value,
                  usuario_id: "",
                })
              }
            >
              <option value="">Todas</option>
              {sucursales.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre}
                </option>
              ))}
            </select>
          </label>

          <label>
            Empleado / admin
            <select
              className="nice-select"
              value={filtros.usuario_id}
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  usuario_id: e.target.value,
                })
              }
            >
              <option value="">Todos</option>

              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre} — {usuario.rol}
                </option>
              ))}
            </select>
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

        <div className="sales-summary-grid">
          <div>
            <span>Total válido</span>
            <strong>{moneda(resumen.total_validas)}</strong>
          </div>

          <div>
            <span>Ventas válidas</span>
            <strong>{resumen.cantidad_validas}</strong>
          </div>

          <div>
            <span>Ventas anuladas</span>
            <strong>{resumen.cantidad_anuladas}</strong>
          </div>

          <div>
            <span>Registros encontrados</span>
            <strong>{resumen.total_registros}</strong>
          </div>
        </div>

        <div className="payment-summary-grid">
          {(resumen.metodos_pago || []).map((item) => (
            <div key={item.metodo_pago}>
              <span>{item.metodo_pago || "Sin método"}</span>
              <strong>{moneda(item.total)}</strong>
              <small>{item.cantidad} ventas</small>
            </div>
          ))}
        </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Factura</th>
                <th>Empleado</th>
                <th>Sucursal</th>
                <th>Método</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {ventas.map((venta) => (
                <tr key={venta.id}>
                  <td>{fecha(venta.fecha_venta_colombia || venta.fecha_venta)}</td>
                  <td>{venta.numero_factura}</td>
                  <td>{venta.empleado_nombre}</td>
                  <td>{venta.sucursal_nombre || "Sin sucursal"}</td>
                  <td>{venta.metodo_pago}</td>
                  <td>{moneda(venta.total)}</td>
                  <td>{venta.estado || "VALIDA"}</td>
                  <td>
                    <button
                      className="mini-button"
                      onClick={() => verDetalle(venta.id)}
                    >
                      Ver / Editar
                    </button>
                  </td>
                </tr>
              ))}

              {ventas.length === 0 && (
                <tr>
                  <td colSpan="8">No hay ventas para estos filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-bar">
          <button
            className="mini-button"
            onClick={() => cambiarPagina(resumen.page - 1)}
            disabled={resumen.page <= 1}
          >
            Anterior
          </button>

          <span>
            Página {resumen.page} de {resumen.total_pages || 1}
          </span>

          <button
            className="mini-button"
            onClick={() => cambiarPagina(resumen.page + 1)}
            disabled={resumen.page >= resumen.total_pages}
          >
            Siguiente
          </button>
        </div>
      </div>

      {ventaDetalle && (
        <div className="panel-card no-print">
          <h2>Detalle venta #{ventaDetalle.id}</h2>

          <p>
            <strong>Factura:</strong> {ventaDetalle.numero_factura}
          </p>

          <p>
            <strong>Empleado:</strong> {ventaDetalle.empleado_nombre}
          </p>

          <p>
            <strong>Fecha:</strong>{" "}
            {fecha(ventaDetalle.fecha_venta_colombia || ventaDetalle.fecha_venta)}
          </p>

          <p>
            <strong>Estado:</strong> {ventaDetalle.estado || "VALIDA"}
          </p>

          <p>
            <strong>Dinero entregado:</strong>{" "}
            {moneda(ventaDetalle.monto_recibido)}
          </p>

          <p>
            <strong>Cambio:</strong> {moneda(ventaDetalle.cambio)}
          </p>
          {(ventaDetalle.pagos_desglose || []).map((p) => <p key={p.metodo_pago_id}><strong>{p.metodo_pago}:</strong> {moneda(p.monto)}</p>)}

          <form className="admin-form" onSubmit={guardarCorreccionProductos}>
            <h3>Corregir productos vendidos</h3>

            <p>
              Cambia la cantidad del producto registrado. Si colocas 0, ese
              producto se elimina de la venta.
            </p>

            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Precio unitario</th>
                    <th>Cantidad original</th>
                    <th>Cantidad corregida</th>
                    <th>Nuevo subtotal</th>
                  </tr>
                </thead>

                <tbody>
                  {detallesEditables.map((item) => {
                    const precio = Number(item.precio_unitario || 0);
                    const descuento = Number(item.descuento_porcentaje || 0);
                    const precioConDescuento =
                      precio - precio * (descuento / 100);
                    const nuevoSubtotal =
                      precioConDescuento * Number(item.cantidad || 0);

                    const original = detalles.find((d) => d.id === item.id);

                    return (
                      <tr key={item.id}>
                        <td>{item.producto_nombre}</td>
                        <td>{moneda(item.precio_unitario)}</td>
                        <td>{original?.cantidad}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={item.cantidad}
                            className="small-number-input"
                            onChange={(e) =>
                              cambiarCantidad(item.id, e.target.value)
                            }
                          />
                        </td>
                        <td>{moneda(nuevoSubtotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="totals-box">
              <div>
                <span>Subtotal corregido</span>
                <strong>{moneda(subtotalEditable)}</strong>
              </div>

              <div>
                <span>Propina {ventaDetalle.propina_porcentaje || 0}%</span>
                <strong>{moneda(propinaEditable)}</strong>
              </div>

              <div>
                <span>Total corregido</span>
                <strong>{moneda(totalEditable)}</strong>
              </div>

              <div>
                <span>Dinero entregado</span>
                <strong>{moneda(ventaDetalle.monto_recibido)}</strong>
              </div>

              <div>
                <span>Cambio registrado</span>
                <strong>{moneda(ventaDetalle.cambio)}</strong>
              </div>
            </div>

            {ventaDetalle.pagos_desglose?.length > 1 && <PagoMixto montos={montosMixtos} onChange={setMontosMixtos} total={totalEditable} />}
            {efectivoRecibido !== "" && <label>Efectivo recibido
              <input type="number" min="0" step="0.01" required value={efectivoRecibido} onChange={(e) => setEfectivoRecibido(e.target.value)} />
            </label>}

            <label>
              Motivo de corrección
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ejemplo: empleado registró 2 Coca-Colas pero realmente fue 1"
              />
            </label>

            <div className="action-row">
              <button className="btn btn-primary">
                Guardar corrección
              </button>

              <button
                type="button"
                className="btn btn-outline"
                onClick={imprimir}
              >
                Reimprimir factura
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={anularVenta}
              >
                Anular venta
              </button>
            </div>
          </form>

          <div className="panel-card">
            <h3>Auditoría</h3>

            {auditoria.map((item) => (
              <div key={item.id} className="audit-row">
                <strong>{item.accion}</strong>
                <span>{fecha(item.creado_en_colombia || item.creado_en)}</span>
                <p>{item.motivo}</p>
                <small>
                  Admin: {item.admin_nombre} — Antes:{" "}
                  {moneda(item.total_anterior)} / Después:{" "}
                  {moneda(item.total_nuevo)}
                </small>
              </div>
            ))}

            {auditoria.length === 0 && <p>Sin auditoría.</p>}
          </div>
        </div>
      )}

      {ventaDetalle && (
        <div className="print-receipt">
          {config?.logo_url && (
            <img src={config.logo_url} alt="Logo" />
          )}

          <h3>{config?.razon_social || "Pan del Canasto"}</h3>
          <p>NIT: {config?.nit || ""}</p>
          <p>{config?.direccion || ""}</p>
          <p>Tel: {config?.telefono || ""}</p>

          <div className="print-divider" />

          <p>Factura: {ventaDetalle.numero_factura}</p>
          <p>Empleado: {ventaDetalle.empleado_nombre}</p>
          <p>
            Fecha:{" "}
            {fecha(ventaDetalle.fecha_venta_colombia || ventaDetalle.fecha_venta)}
          </p>
          <p>Estado: {ventaDetalle.estado || "VALIDA"}</p>

          <div className="print-divider" />

          <div className="factura-tabla-header">
            <span>Producto</span>
            <span>Cant</span>
            <span>Valor</span>
          </div>

          <div className="print-divider" />

          {detalles.map((item) => (
            <div className="factura-item-row" key={item.id}>
              <span className="producto-col">{item.producto_nombre}</span>
              <span className="cantidad-col">{item.cantidad}</span>
              <span className="valor-col">{moneda(item.subtotal)}</span>
            </div>
          ))}

          <div className="print-divider" />

          <div className="print-line">
            <span>Subtotal</span>
            <span>{moneda(ventaDetalle.subtotal)}</span>
          </div>

          <div className="print-line">
            <span>Propina</span>
            <span>
              {moneda(ventaDetalle.propina_valor || ventaDetalle.propina)}
            </span>
          </div>

          <div className="print-line">
            <strong>Total</strong>
            <strong>{moneda(ventaDetalle.total)}</strong>
          </div>

          {ventaDetalle.pagos_desglose?.length > 0 && <ReciboPagos pago={ventaDetalle} />}
          {!ventaDetalle.pagos_desglose?.length && <div className="print-line">
            <span>Recibido</span>
            <span>{moneda(ventaDetalle.monto_recibido)}</span>
          </div>}

          {!ventaDetalle.pagos_desglose?.length && <div className="print-line">
            <span>Cambio</span>
            <span>{moneda(ventaDetalle.cambio)}</span>
          </div>}

          <div className="print-divider" />

          <p>{config?.mensaje_inferior || "Gracias por su compra"}</p>
        </div>
      )}
    </div>
  );
}
