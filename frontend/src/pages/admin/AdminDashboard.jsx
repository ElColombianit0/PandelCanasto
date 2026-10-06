import { useEffect, useState } from "react";
import {
  DollarSign,
  ShoppingBag,
  Table2,
  ReceiptText,
} from "lucide-react";

import DashboardCard from "../../components/DashboardCard.jsx";
import api from "../../api/api.js";

export default function AdminDashboard() {
  const [data, setData] = useState({
    resumen: {
      total_ventas: 0,
      cantidad_ventas: 0,
      total_ventas_mes: 0,
      cantidad_ventas_mes: 0,
      pedidos_activos: 0,
      mesas_ocupadas: 0,
      facturas_dia: 0,
    },
    ventas_dia: [],
    ventas_mes_historial: [],
    ventas_por_metodo_pago: [],
    productos_mas_vendidos: [],
    ventas_por_empleado: [],
    ventas_por_sucursal: [],
    sucursales: [],
  });
  const [sucursalId, setSucursalId] = useState("");
  const [periodoProductos, setPeriodoProductos] = useState("mes");

  useEffect(() => {
    cargarResumen();
  }, [sucursalId, periodoProductos]);

  async function cargarResumen() {
    try {
      const params = new URLSearchParams();
      if (sucursalId) params.append("sucursal_id", sucursalId);
      params.append("productos_periodo", periodoProductos);
      const { data } = await api.get(`/reportes/dashboard?${params.toString()}`);
      setData(data);
    } catch {
      console.log("No se pudo cargar resumen");
    }
  }

  function moneda(valor) {
    return `$${Number(valor || 0).toLocaleString("es-CO")}`;
  }

  function hora(fecha) {
    if (!fecha) return "";

    const texto = String(fecha);
    const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);

    if (match) {
      return `${match[3]}/${match[2]}, ${match[4]}:${match[5]}`;
    }

    return new Date(fecha).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  }

  const r = data.resumen;

  return (
    <div>
      <div className="panel-card dashboard-filter-card">
        <label>
          Sucursal
          <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {(data.sucursales || []).map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Mas vendidos
          <select
            value={periodoProductos}
            onChange={(e) => setPeriodoProductos(e.target.value)}
          >
            <option value="mes">Del mes</option>
            <option value="dia">Del dia</option>
          </select>
        </label>
      </div>

      <div className="dashboard-grid">
        <DashboardCard
          title="Ventas del día"
          value={moneda(r.total_ventas)}
          description={`${r.cantidad_ventas} ventas registradas hoy`}
          icon={<DollarSign />}
        />

        <DashboardCard
          title="Ventas del mes"
          value={moneda(r.total_ventas_mes)}
          description={`${r.cantidad_ventas_mes} ventas este mes`}
          icon={<ReceiptText />}
        />

        <DashboardCard
          title="Pedidos activos"
          value={r.pedidos_activos}
          description="Mesas y ventas rápidas abiertas"
          icon={<ShoppingBag />}
        />

        <DashboardCard
          title="Mesas ocupadas"
          value={r.mesas_ocupadas}
          description="Mesas actualmente en atención"
          icon={<Table2 />}
        />
      </div>

      <div className="panel-card">
        <h2>Ventas del día por método de pago</h2>
        <div className="payment-summary-grid">
          {(data.ventas_por_metodo_pago || []).map((item) => (
            <div key={item.metodo_pago}>
              <span>{item.metodo_pago || "Sin método"}</span>
              <strong>{moneda(item.total)}</strong>
              <small>{item.cantidad} ventas</small>
            </div>
          ))}

          {(data.ventas_por_metodo_pago || []).length === 0 && (
            <p>No hay ventas registradas hoy.</p>
          )}
        </div>
      </div>

      <div className="panel-card">
        <h2>Ventas del día</h2>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Factura</th>
                <th>Empleado</th>
                <th>Sucursal</th>
                <th>Método</th>
                <th>Subtotal</th>
                <th>Propina</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {data.ventas_dia.map((venta) => (
                <tr key={venta.id}>
                  <td>{hora(venta.fecha_venta_colombia || venta.fecha_venta)}</td>
                  <td>{venta.numero_factura}</td>
                  <td>{venta.empleado_nombre}</td>
                  <td>{venta.sucursal_nombre || "Sin sucursal"}</td>
                  <td>{venta.metodo_pago}</td>
                  <td>{moneda(venta.subtotal)}</td>
                  <td>{moneda(venta.propina_valor)}</td>
                  <td>{moneda(venta.total)}</td>
                </tr>
              ))}

              {data.ventas_dia.length === 0 && (
                <tr>
                  <td colSpan="8">No hay ventas registradas hoy.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-two-columns">
        <div className="panel-card">
          <h2>Historial del mes</h2>

          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Ventas</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {data.ventas_mes_historial.map((dia) => (
                  <tr key={dia.fecha}>
                    <td>{dia.fecha}</td>
                    <td>{dia.cantidad}</td>
                    <td>{moneda(dia.total)}</td>
                  </tr>
                ))}

                {data.ventas_mes_historial.length === 0 && (
                  <tr>
                    <td colSpan="3">No hay ventas este mes.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel-card">
          <h2>Ventas por empleado</h2>

          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Sucursal</th>
                  <th>Ventas</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {data.ventas_por_empleado.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nombre}</td>
                    <td>{item.sucursal_nombre || "Sin sucursal"}</td>
                    <td>{item.cantidad_ventas}</td>
                    <td>{moneda(item.total_vendido)}</td>
                  </tr>
                ))}

                {data.ventas_por_empleado.length === 0 && (
                  <tr>
                    <td colSpan="4">Sin ventas por empleado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel-card">
        <h2>
          Productos más vendidos {periodoProductos === "dia" ? "del dia" : "del mes"}
        </h2>

        <div className="top-products-grid">
          {data.productos_mas_vendidos.map((producto) => (
            <div key={producto.id} className="top-product-card">
              <img src={producto.imagen_url || "/logo.png"} />
              <div>
                <strong>{producto.nombre}</strong>
                <span>{producto.cantidad_vendida} unidades</span>
                <p>{moneda(producto.total_vendido)}</p>
              </div>
            </div>
          ))}

          {data.productos_mas_vendidos.length === 0 && (
            <p>
              No hay productos vendidos {periodoProductos === "dia" ? "hoy" : "este mes"}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
