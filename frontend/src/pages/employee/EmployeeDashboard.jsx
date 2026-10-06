import { ShoppingCart, Table2, ReceiptText } from "lucide-react";
import DashboardCard from "../../components/DashboardCard.jsx";

export default function EmployeeDashboard() {
  return (
    <div>
      <div className="dashboard-grid">
        <DashboardCard
          title="Venta rápida"
          value="Nueva"
          description="Cliente compra y se va"
          icon={<ShoppingCart />}
        />

        <DashboardCard
          title="Mesas activas"
          value="0"
          description="Agregar productos a cuentas abiertas"
          icon={<Table2 />}
        />

        <DashboardCard
          title="Facturación"
          value="POS / Electrónica"
          description="El empleado puede emitir si el cliente solicita"
          icon={<ReceiptText />}
        />
      </div>

      <div className="panel-card">
        <h2>Panel de empleado</h2>
        <p>
          Aquí el empleado podrá registrar ventas rápidas, abrir mesas, agregar
          productos a la cuenta, cobrar, calcular cambio, incluir propina si está
          habilitada e imprimir factura.
        </p>
      </div>
    </div>
  );
}