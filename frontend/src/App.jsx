import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext.jsx";
import PrivateRoute from "./routes/PrivateRoute.jsx";

import PublicLayout from "./layouts/PublicLayout.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";

import HomePage from "./pages/public/HomePage.jsx";
import MenuPage from "./pages/public/MenuPage.jsx";
import NosotrosPage from "./pages/public/NosotrosPage.jsx";
import UbicacionPage from "./pages/public/UbicacionPage.jsx";
import ContactoPage from "./pages/public/ContactoPage.jsx";
import EventosPage from "./pages/public/EventosPage.jsx";
import RecetasAdmin from "./pages/admin/RecetasAdmin.jsx";

import LoginPage from "./pages/auth/LoginPage.jsx";

import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import ProductosAdmin from "./pages/admin/ProductosAdmin.jsx";
import PromocionesAdmin from "./pages/admin/PromocionesAdmin.jsx";
import CategoriasAdmin from "./pages/admin/CategoriasAdmin.jsx";
import MesasAdmin from "./pages/admin/MesasAdmin.jsx";
import ConfiguracionFactura from "./pages/admin/ConfiguracionFactura.jsx";
import ConfiguracionAdmin from "./pages/admin/ConfiguracionAdmin.jsx";
import EmpleadosAdmin from "./pages/admin/EmpleadosAdmin.jsx";
import UtilidadNetaAdmin from "./pages/admin/UtilidadNetaAdmin.jsx";
import PaginaPublicaAdmin from "./pages/admin/PaginaPublicaAdmin.jsx";
import InventarioAdmin from "./pages/admin/InventarioAdmin.jsx";
import VentasAdmin from "./pages/admin/VentasAdmin.jsx";
import CierreCajaAdmin from "./pages/admin/CierreCajaAdmin.jsx";
import BajasInventarioAdmin from "./pages/admin/BajasInventarioAdmin.jsx";

import EmployeeDashboard from "./pages/employee/EmployeeDashboard.jsx";
import VentasEmpleado from "./pages/employee/VentasEmpleado.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/nosotros" element={<NosotrosPage />} />
            <Route path="/ubicacion" element={<UbicacionPage />} />
            <Route path="/contacto" element={<ContactoPage />} />
            <Route path="/eventos" element={<EventosPage />} />
          </Route>

          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/admin"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <AdminDashboard />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/productos"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <ProductosAdmin />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/promociones"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <PromocionesAdmin />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/categorias"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <CategoriasAdmin />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/mesas"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <MesasAdmin />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/configuracion-factura"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <ConfiguracionFactura />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/configuracion"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <ConfiguracionAdmin />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/utilidad-neta"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <UtilidadNetaAdmin />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/empleados"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <EmpleadosAdmin />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/pagina-publica"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <PaginaPublicaAdmin />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/inventario"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <InventarioAdmin />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/bajas-inventario"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <BajasInventarioAdmin />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/ventas"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <VentasAdmin />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/cierre-caja"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <CierreCajaAdmin />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/empleado"
            element={
              <PrivateRoute allowedRoles={["EMPLEADO", "ADMIN"]}>
                <DashboardLayout>
                  <EmployeeDashboard />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/empleado/ventas"
            element={
              <PrivateRoute allowedRoles={["EMPLEADO", "ADMIN"]}>
                <DashboardLayout>
                  <VentasEmpleado />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/recetas"
            element={
              <PrivateRoute allowedRoles={["ADMIN"]}>
                <DashboardLayout>
                  <RecetasAdmin />
                </DashboardLayout>
              </PrivateRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
