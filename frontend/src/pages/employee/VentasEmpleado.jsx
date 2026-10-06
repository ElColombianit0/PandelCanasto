import { useEffect, useState } from "react";
import api from "../../api/api.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import PagoMixto, { cantidadesPago, partesPago, montosValidos, ReciboPagos } from "../../components/PagoMixto.jsx";

export default function VentasEmpleado() {
  const { usuario } = useAuth();

  const [productos, setProductos] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [pedidosAbiertos, setPedidosAbiertos] = useState([]);
  const [configFactura, setConfigFactura] = useState(null);

  const [pedidoActual, setPedidoActual] = useState(null);
  const [detalles, setDetalles] = useState([]);

  const [tipoVenta, setTipoVenta] = useState("RAPIDA");
  const [mesaId, setMesaId] = useState("");
  const [metodoPagoId, setMetodoPagoId] = useState("1");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [montosMixtos, setMontosMixtos] = useState(cantidadesPago);
  const [cobrando, setCobrando] = useState(false);
  const [propinaPorcentaje, setPropinaPorcentaje] = useState(0);
  const [facturaElectronica, setFacturaElectronica] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ultimaFactura, setUltimaFactura] = useState(null);

  useEffect(() => {
    cargarInicial();
  }, []);

  async function cargarInicial() {
    try {
      const [productosRes, mesasRes, pedidosRes] = await Promise.all([
        api.get("/productos"),
        api.get("/mesas"),
        api.get("/pedidos/abiertos"),
      ]);

      setProductos(productosRes.data.productos || []);
      setMesas(mesasRes.data.mesas || []);
      setPedidosAbiertos(pedidosRes.data.pedidos || []);

      try {
        const configRes = await api.get("/configuracion-factura");
        setConfigFactura(configRes.data.configuracion || null);
      } catch {
        setConfigFactura(null);
      }
    } catch {
      setMensaje("No se pudieron cargar los datos iniciales.");
    }
  }

  async function iniciarPedido() {
    setMensaje("");

    try {
      let res;

      if (tipoVenta === "RAPIDA") {
        res = await api.post("/pedidos/rapido");
      } else {
        if (!mesaId) {
          setMensaje("Selecciona una mesa.");
          return;
        }

        res = await api.post("/pedidos/mesa", {
          mesa_id: mesaId,
        });
      }

      setPedidoActual(res.data.pedido);
      setDetalles([]);
      setPropinaPorcentaje(0);
      setMontoRecibido("");
      setMontosMixtos(cantidadesPago());
      setUltimaFactura(null);
      cargarInicial();
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo iniciar pedido.");
    }
  }

  async function seleccionarPedido(pedido) {
    setMensaje("");

    try {
      const { data } = await api.get(`/pedidos/${pedido.id}`);

      if (pedidoActual?.id !== data.pedido.id) {
        setMontoRecibido("");
        setMontosMixtos(cantidadesPago());
      }

      setPedidoActual(data.pedido);
      setDetalles(data.detalles || []);
      setPropinaPorcentaje(Number(data.pedido.propina_porcentaje || 0));
      setUltimaFactura(null);
    } catch {
      setMensaje("No se pudo cargar el pedido.");
    }
  }

  async function agregarProducto(producto) {
    if (!pedidoActual) {
      setMensaje("Primero inicia una venta o selecciona un pedido.");
      return;
    }

    try {
      await api.post("/pedidos/detalle", {
        pedido_id: pedidoActual.id,
        producto_id: producto.id,
        cantidad: 1,
      });

      await seleccionarPedido(pedidoActual);
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo agregar producto.");
    }
  }

  async function quitarDetalle(detalleId) {
    try {
      await api.delete(`/pedidos/detalle/${detalleId}`);
      await seleccionarPedido(pedidoActual);
    } catch {
      setMensaje("No se pudo quitar el producto.");
    }
  }

  async function actualizarCantidadDetalle(detalleId, cantidad) {
    try {
      await api.patch(`/pedidos/detalle/${detalleId}`, {
        cantidad: Math.max(0, Number(cantidad || 0)),
      });
      await seleccionarPedido(pedidoActual);
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo actualizar la cantidad.");
    }
  }

  async function guardarPropina(valor) {
    setPropinaPorcentaje(valor);

    if (!pedidoActual) return;

    try {
      await api.patch(`/pedidos/${pedidoActual.id}/propina`, {
        propina_porcentaje: Number(valor || 0),
      });

      await seleccionarPedido(pedidoActual);
    } catch {
      setMensaje("No se pudo actualizar la propina.");
    }
  }

  async function cobrarPedido() {
    if (cobrando) return;
    setMensaje("");

    if (!pedidoActual) {
      setMensaje("No hay pedido seleccionado.");
      return;
    }

    const recibido = Number(montoRecibido);

    const partes = partesPago(montosMixtos);
    if (esMixto && (!montosValidos(montosMixtos) || partes.length < 2 || partes.reduce((s, p) => s + Math.round(p.monto * 100), 0) !== Math.round(total * 100))) {
      setMensaje("Reparte el total entre al menos dos medios de pago. La suma debe coincidir con el total.");
      return;
    }

    if (requiereEfectivo && (montoRecibido === "" || !Number.isFinite(recibido))) {
      setMensaje("Ingresa el dinero recibido antes de registrar la venta.");
      return;
    }

    if (requiereEfectivo && recibido < parteEfectivo) {
      setMensaje("El dinero recibido no puede ser menor a la parte en efectivo.");
      return;
    }

    setCobrando(true);
    try {
      const { data } = await api.post("/pedidos/cobrar", {
        pedido_id: pedidoActual.id,
        metodo_pago_id: metodoPagoId,
        monto_recibido: requiereEfectivo ? montoRecibido : undefined,
        ...(esMixto ? { pagos_desglose: partes } : {}),
        factura_electronica: facturaElectronica,
      });

      const facturaCompleta = {
        factura: data.factura,
        venta: data.venta,
        pago: data.pago,
        detalles,
        empleado: usuario,
        config: configFactura,
        metodo_pago_id: metodoPagoId,
        pedido: pedidoActual,
      };

      setUltimaFactura(facturaCompleta);
      setMensaje(`Venta registrada. Factura: ${data.factura.numero_factura}`);

      setTimeout(() => {
        window.print();
      }, 400);

      setPedidoActual(null);
      setDetalles([]);
      setMontoRecibido("");
      setMontosMixtos(cantidadesPago());
      setPropinaPorcentaje(0);
      cargarInicial();
    } catch (error) {
      setMensaje(error.response?.data?.message || "No se pudo cobrar.");
    } finally {
      setCobrando(false);
    }
  }

  function urlImagen(url) {
    if (!url) return "/logo.png";
    if (url.startsWith("http")) return url;
    return url;
  }

  const productosFiltrados = productos
    .filter((p) => p.disponible_venta && p.activo)
    .filter((p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

  const subtotal = detalles.reduce(
    (acc, item) => acc + Number(item.subtotal || 0),
    0
  );

  const propinaValor = Number((subtotal * (Number(propinaPorcentaje || 0) / 100)).toFixed(2));
  const total = Number((subtotal + propinaValor).toFixed(2));
  const esPagoEfectivo = metodoPagoId === "1";
  const esMixto = metodoPagoId === "MIXTO";
  const parteEfectivo = esMixto ? Number(montosMixtos["1"] || 0) : esPagoEfectivo ? total : 0;
  const requiereEfectivo = esPagoEfectivo || (esMixto && parteEfectivo > 0);
  const cambio = Number(montoRecibido || 0) - parteEfectivo;
  const metodosPago = [
    { id: "1", nombre: "Efectivo" },
    { id: "2", nombre: "Tarjeta" },
    { id: "3", nombre: "Transferencia" },
    { id: "MIXTO", nombre: "Mixto" },
  ];

  return (
    <div>
      {mensaje && <div className="info-message">{mensaje}</div>}

      <div className="ventas-layout">
        <div className="panel-card">
          <h2>Nueva venta</h2>

          <div className="sale-options">
            <label>
              Tipo de venta
              <select
                className="nice-select"
                value={tipoVenta}
                onChange={(e) => setTipoVenta(e.target.value)}
              >
                <option value="RAPIDA">Venta rápida</option>
                <option value="MESA">Mesa</option>
              </select>
            </label>

            {tipoVenta === "MESA" && (
              <label>
                Mesa
                <select
                  className="nice-select"
                  value={mesaId}
                  onChange={(e) => setMesaId(e.target.value)}
                >
                  <option value="">Seleccionar mesa</option>
                  {mesas.map((mesa) => (
                    <option key={mesa.id} value={mesa.id}>
                      {mesa.nombre} - {mesa.estado}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <button className="btn btn-primary" onClick={iniciarPedido}>
            Iniciar pedido
          </button>

          <h3>Pedidos abiertos</h3>

          <div className="open-orders">
            {pedidosAbiertos.map((pedido) => (
              <button
                key={pedido.id}
                onClick={() => seleccionarPedido(pedido)}
                className="open-order-button"
              >
                <strong>
                  {pedido.tipo_pedido === "MESA"
                    ? pedido.mesa_nombre
                    : `Rápida #${pedido.id}`}
                </strong>
                <span>${Number(pedido.total).toLocaleString("es-CO")}</span>
              </button>
            ))}

            {pedidosAbiertos.length === 0 && <p>No hay pedidos abiertos.</p>}
          </div>

          <h3>Productos disponibles</h3>

          <input
            className="product-search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto por nombre..."
          />

          <div className="sale-products">
            {productosFiltrados.map((producto) => (
              <button
                key={producto.id}
                onClick={() => agregarProducto(producto)}
                className="sale-product-button product-button-with-image"
              >
                <img
                  src={urlImagen(producto.imagen_url)}
                  className="product-thumb"
                  alt={producto.nombre}
                />

                <strong>{producto.nombre}</strong>

                <span>
                  ${Number(producto.precio_venta).toLocaleString("es-CO")}
                </span>
              </button>
            ))}

            {productosFiltrados.length === 0 && (
              <p>No hay productos que coincidan con la búsqueda.</p>
            )}
          </div>
        </div>

        <div className="panel-card">
          <h2>Cuenta actual</h2>

          {!pedidoActual && <p>No hay pedido seleccionado.</p>}

          {pedidoActual && (
            <>
              <p>
                Pedido #{pedidoActual.id} — {pedidoActual.tipo_pedido}
              </p>

              {detalles.map((item) => (
                <div className="cart-row" key={item.id}>
                  <div>
                    <strong>{item.producto_nombre}</strong>
                    <span>
                      x{item.cantidad} — $
                      {Number(item.subtotal).toLocaleString("es-CO")}
                    </span>
                  </div>

                  <div className="cart-quantity-controls">
                    <button
                      type="button"
                      onClick={() =>
                        actualizarCantidadDetalle(item.id, Number(item.cantidad || 0) - 1)
                      }
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={item.cantidad}
                      onChange={(e) => actualizarCantidadDetalle(item.id, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        actualizarCantidadDetalle(item.id, Number(item.cantidad || 0) + 1)
                      }
                    >
                      +
                    </button>
                    <button type="button" onClick={() => quitarDetalle(item.id)}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}

              {detalles.length === 0 && <p>No hay productos agregados.</p>}

              <div className="totals-box">
                <div>
                  <span>Subtotal</span>
                  <strong>${subtotal.toLocaleString("es-CO")}</strong>
                </div>

                <label>
                  Propina %
                  <input
                    type="number"
                    value={propinaPorcentaje}
                    onChange={(e) => guardarPropina(e.target.value)}
                    placeholder="10"
                  />
                </label>

                <div>
                  <span>Valor propina</span>
                  <strong>${propinaValor.toLocaleString("es-CO")}</strong>
                </div>

                <div className="payment-method-group">
                  <span>Método de pago</span>
                  <div className="payment-method-options">
                    {metodosPago.map((metodo) => (
                      <label
                        key={metodo.id}
                        className={`payment-method-option ${
                          metodoPagoId === metodo.id ? "selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="metodo_pago"
                          value={metodo.id}
                          checked={metodoPagoId === metodo.id}
                          onChange={(e) => {
                            setMetodoPagoId(e.target.value);
                            if (e.target.value !== "1") {
                              setMontoRecibido("");
                            }
                          }}
                        />
                        {metodo.nombre}
                      </label>
                    ))}
                  </div>
                </div>

                {esMixto && <PagoMixto montos={montosMixtos} onChange={setMontosMixtos} total={total} />}

                {requiereEfectivo && (
                  <label>
                    {esMixto ? "Efectivo recibido" : "Dinero recibido"}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={montoRecibido}
                      onChange={(e) => setMontoRecibido(e.target.value)}
                      placeholder={String(Math.ceil(parteEfectivo))}
                      required
                    />
                  </label>
                )}

                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={facturaElectronica}
                    onChange={(e) => setFacturaElectronica(e.target.checked)}
                  />
                  Emitir factura electrónica
                </label>

                <div>
                  <span>Total</span>
                  <strong>${total.toLocaleString("es-CO")}</strong>
                </div>

                {requiereEfectivo && (
                  <div>
                    <span>Cambio</span>
                    <strong>
                      ${Math.max(cambio, 0).toLocaleString("es-CO")}
                    </strong>
                  </div>
                )}
              </div>

              <button className="btn btn-primary btn-full" onClick={cobrarPedido} disabled={cobrando || !detalles.length}>
                {cobrando ? "Registrando..." : "Cobrar e imprimir"}
              </button>
            </>
          )}
        </div>
      </div>

      <FacturaImprimible facturaData={ultimaFactura} />
    </div>
  );
}

function FacturaImprimible({ facturaData }) {
  if (!facturaData) return null;

  const { factura, venta, pago, detalles, empleado, config, metodo_pago_id } = facturaData;
  const esEfectivo = String(metodo_pago_id) === "1";

  const razonSocial = config?.razon_social || "Pan del Canasto";
  const nit = config?.nit || "NIT pendiente";
  const direccion = config?.direccion || "";
  const telefono = config?.telefono || "";
  const mensaje = config?.mensaje_inferior || "Gracias por su compra";

  return (
    <div className="print-receipt">

    {config?.logo_url && (
      <img
  src={config.logo_url}
  alt="Logo"
  className="print-logo"

/>
      )}
      <h3>{razonSocial}</h3>
      <p>NIT: {nit}</p>
      {direccion && <p>{direccion}</p>}
      {telefono && <p>Tel: {telefono}</p>}

      <div className="print-divider" />

      <p>Factura: {factura.numero_factura}</p>
      <p>Empleado: {empleado?.nombre || "Empleado"}</p>
      <p>
        Fecha:{" "}
        {new Date().toLocaleString("es-CO", {
          timeZone: "America/Bogota",
        })}
      </p>

      <div className="print-divider" />

      <div className="factura-tabla-header">
  <span>Producto</span>
  <span>Cant</span>
  <span>Valor</span>
</div>

<div className="print-divider" />

{detalles.map((item) => (
  <div className="factura-item-row" key={item.id}>
    <span className="producto-col">
      {item.producto_nombre}
    </span>

    <span className="cantidad-col">
      {item.cantidad}
    </span>

    <span className="valor-col">
      ${Number(item.subtotal).toLocaleString("es-CO")}
    </span>
  </div>
))}

      <div className="print-divider" />

      <div className="print-line">
        <span>Subtotal</span>
        <span>${Number(venta.subtotal).toLocaleString("es-CO")}</span>
      </div>

      <div className="print-line">
        <span>Propina</span>
        <span>${Number(venta.propina_valor || venta.propina || 0).toLocaleString("es-CO")}</span>
      </div>

      <div className="print-line">
        <strong>Total</strong>
        <strong>${Number(venta.total).toLocaleString("es-CO")}</strong>
      </div>

      {pago.pagos_desglose?.length ? <ReciboPagos pago={pago} /> : esEfectivo ? (
        <>
          <div className="print-line">
            <span>Recibido</span>
            <span>${Number(pago.monto_recibido || 0).toLocaleString("es-CO")}</span>
          </div>

          <div className="print-line">
            <span>Cambio</span>
            <span>${Number(pago.cambio || 0).toLocaleString("es-CO")}</span>
          </div>
        </>
      ) : (
        <div className="print-line">
          <span>Pagado</span>
          <span>${Number(venta.total || 0).toLocaleString("es-CO")}</span>
        </div>
      )}

      <div className="print-divider" />

      <p>{mensaje}</p>
    </div>
  );
}
