import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, Search, X } from "lucide-react";

export default function Navbar() {
  const [abierto, setAbierto] = useState(false);

  return (
    <header className="premium-navbar">
      <div className="premium-navbar-inner">
        <Link to="/" className="premium-brand" onClick={() => setAbierto(false)}>
          <img src="/logo.png" alt="Pan del Canasto" />
        </Link>

        <nav className={`premium-nav-links ${abierto ? "open" : ""}`}>
          <Link to="/menu" onClick={() => setAbierto(false)}>
            Menú
          </Link>
          <Link to="/eventos" onClick={() => setAbierto(false)}>
            Eventos
          </Link>
          <Link to="/nosotros" onClick={() => setAbierto(false)}>
            Nosotros
          </Link>
          <Link to="/ubicacion" onClick={() => setAbierto(false)}>
            Visítanos
          </Link>
          <Link to="/contacto" onClick={() => setAbierto(false)}>
            Contáctanos
          </Link>
        </nav>

        <div className="premium-search-box">
          <input placeholder="¿Tengo antojos de...?" />
          <Search size={22} />
        </div>

        <Link to="/login" className="premium-login" onClick={() => setAbierto(false)}>
          Iniciar sesión
        </Link>

        <button
          className="mobile-menu-button"
          onClick={() => setAbierto(!abierto)}
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={abierto}
        >
          {abierto ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
