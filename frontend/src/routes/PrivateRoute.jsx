import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function PrivateRoute({
  children,
  allowedRoles = [],
}) {
  const {
    autenticado,
    usuario,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontSize: "22px",
        }}
      >
        Cargando...
      </div>
    );
  }

  if (!autenticado || !usuario) {
    return <Navigate to="/login" replace />;
  }

  if (
    allowedRoles.length > 0 &&
    !allowedRoles.includes(usuario.rol)
  ) {
    return <Navigate to="/" replace />;
  }

  return children;
}
