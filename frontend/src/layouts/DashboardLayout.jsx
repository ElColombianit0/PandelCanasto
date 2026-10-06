import { Link, useNavigate } from "react-router-dom";
import {
  Calculator,
  ChefHat,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Table2,
  Warehouse,
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext.jsx";

export default function DashboardLayout({ children }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function cerrarSesion() {
    logout();
    navigate("/login");
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="Pan del Canasto" />
          <div>
            <strong>Pan del Canasto</strong>
            <span>{usuario?.rol}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <Link to={usuario?.rol === "ADMIN" ? "/admin" : "/empleado"}>
            <LayoutDashboard size={20} />
            Dashboard
          </Link>

          {usuario?.rol === "ADMIN" && (
            <Link to="/admin/ventas">
              <ShoppingCart size={20} />
              Administrar ventas
            </Link>
          )}

          <Link to="/empleado/ventas">
            <ShoppingCart size={20} />
            Ventas
          </Link>

          {usuario?.rol === "ADMIN" && (
            <>
              <Link to="/admin/productos">
                <Package size={20} />
                Productos
              </Link>

              <Link to="/admin/inventario">
                <Warehouse size={20} />
                Inventario
              </Link>

              <Link to="/admin/categorias">
                <Package size={20} />
                Categorias
              </Link>

              <Link to="/admin/recetas">
                <ChefHat size={20} />
                Recetas
              </Link>

              <Link to="/admin/promociones">
                <ShoppingCart size={20} />
                Promociones
              </Link>

              <Link to="/admin/mesas">
                <Table2 size={20} />
                Mesas
              </Link>

              <Link to="/admin/utilidad-neta">
                <Calculator size={20} />
                Utilidades netas
              </Link>

              <Link to="/admin/bajas-inventario">
                <Warehouse size={20} />
                Bajas inventario
              </Link>

              <Link to="/admin/cierre-caja">
                <ReceiptText size={20} />
                Cierre de Caja
              </Link>

              <Link to="/admin/configuracion-factura">
                <ReceiptText size={20} />
                Factura POS
              </Link>

              <Link to="/admin/empleados">
                <Settings size={20} />
                Empleados
              </Link>

              <Link to="/admin/pagina-publica">
                <Settings size={20} />
                Pagina publica
              </Link>

              <Link to="/admin/configuracion">
                <Settings size={20} />
                Configuracion
              </Link>
            </>
          )}
        </nav>

        <button className="logout-button" onClick={cerrarSesion}>
          <LogOut size={20} />
          Cerrar sesion
        </button>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1>Panel de gestion</h1>
            <p>Bienvenido, {usuario?.nombre}</p>
          </div>

          <span className="role-pill">{usuario?.rol}</span>
        </header>

        {children}
      </section>
    </div>
  );
}
