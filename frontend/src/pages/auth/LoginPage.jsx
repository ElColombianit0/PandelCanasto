import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/api.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    identificador: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      const { data } = await api.post("/auth/login", form);

      login(data);

      if (data.usuario.rol === "ADMIN") {
        navigate("/admin");
      } else {
        navigate("/empleado");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "No se pudo iniciar sesión. Verifica tus datos."
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <img src="/logo.png" alt="Pan del Canasto" />
          <h1>Pan del Canasto</h1>
          <p>Acceso administrativo y empleados</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="alert-error">{error}</div>}

          <label>
            Correo o documento
            <input
              type="text"
              name="identificador"
              value={form.identificador}
              onChange={handleChange}
              placeholder="Correo o número de documento"
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Tu contraseña"
              required
            />
          </label>

          <button className="btn btn-primary btn-full" disabled={cargando}>
            {cargando ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        <a href="/" className="back-home">
          Volver a la página principal
        </a>
      </section>
    </main>
  );
}
