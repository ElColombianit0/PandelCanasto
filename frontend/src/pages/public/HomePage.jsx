import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/api.js";

function bannerMuestraInformacion(banner) {
  return (
    banner?.mostrar_informacion === true ||
    banner?.mostrar_informacion === "true" ||
    banner?.mostrar_informacion === 1
  );
}

export default function HomePage() {
  const [banners, setBanners] = useState([]);
  const [actual, setActual] = useState(0);
  const touchStartX = useRef(null);

  useEffect(() => {
    cargarBanners();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = setInterval(() => {
      setActual((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [banners]);

  async function cargarBanners() {
    try {
      const { data } = await api.get("/configuracion-sitio/banners");
      const activos = (data.banners || []).filter((b) => b.activo);

      setBanners(activos);
      setActual(0);
    } catch {
      setBanners([]);
    }
  }

  function siguiente() {
    setActual((prev) => (prev + 1) % banners.length);
  }

  function anterior() {
    setActual((prev) => (prev - 1 + banners.length) % banners.length);
  }

  function iniciarDeslizamiento(e) {
    touchStartX.current = e.touches[0].clientX;
  }

  function terminarDeslizamiento(e) {
    if (touchStartX.current === null || banners.length <= 1) return;

    const diferencia = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;

    if (Math.abs(diferencia) < 45) return;

    if (diferencia > 0) {
      siguiente();
    } else {
      anterior();
    }
  }

  const banner = banners[actual];
  const mostrarInformacion = bannerMuestraInformacion(banner);

  return (
    <main className="bakery-home">
      <section
        className={`bakery-carousel ${mostrarInformacion ? "with-info" : "image-only"}`}
        onTouchStart={iniciarDeslizamiento}
        onTouchEnd={terminarDeslizamiento}
      >
        {banner ? (
          <>
            <div className={mostrarInformacion ? "carousel-image" : "carousel-image full-only"}>
              <img
                src={banner.imagen_url || "/logo.png"}
                alt={banner.titulo || "Banner Pan del Canasto"}
                decoding="async"
                fetchPriority={actual === 0 ? "high" : "auto"}
              />
            </div>

            {mostrarInformacion && (
              <div className="carousel-content">
                <img src="/logo.png" alt="Pan del Canasto" className="carousel-logo" />

                <h1>{banner.titulo}</h1>

                <p>{banner.subtitulo}</p>

                {banner.boton_texto && banner.boton_link && (
                  <Link to={banner.boton_link} className="hero-main-button">
                    {banner.boton_texto}
                  </Link>
                )}
              </div>
            )}

            <div className="carousel-dots">
              {banners.map((_, index) => (
                <button
                  key={index}
                  className={index === actual ? "active" : ""}
                  onClick={() => setActual(index)}
                  aria-label={`Ver banner ${index + 1}`}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="carousel-empty">
            <img src="/logo.png" alt="Pan del Canasto" />
            <h1>Pan del Canasto</h1>
            <p>Solo especialidades</p>
            <Link to="/menu" className="hero-main-button">
              Ver menú
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
