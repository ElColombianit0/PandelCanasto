import { useEffect, useMemo, useState } from "react";
import api from "../../api/api.js";

const WHATSAPP_PEDIDO_URL =
  "https://wa.me/573143848277?text=Hola,%20vi%20su%20p%C3%A1gina%20web%20y%20estoy%20interesad@%20en%20realizar%20un%20pedido.%20%C2%BFPodr%C3%ADan%20asesorarme?";

function WhatsAppLogo() {
  return (
    <svg
      aria-hidden="true"
      className="whatsapp-logo"
      viewBox="0 0 32 32"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M16.01 3.2c-7.02 0-12.72 5.66-12.72 12.63 0 2.23.59 4.41 1.71 6.32L3.2 28.8l6.84-1.78a12.84 12.84 0 0 0 5.97 1.48c7.02 0 12.72-5.66 12.72-12.63S23.03 3.2 16.01 3.2Zm0 22.98c-1.9 0-3.75-.51-5.37-1.47l-.39-.23-4.06 1.06 1.08-3.93-.26-.4a10.21 10.21 0 0 1-1.4-5.38c0-5.69 4.66-10.32 10.4-10.32s10.4 4.63 10.4 10.32-4.66 10.35-10.4 10.35Zm5.7-7.73c-.31-.16-1.85-.91-2.14-1.01-.29-.11-.5-.16-.71.16-.21.31-.82 1.01-1.01 1.22-.18.21-.37.24-.68.08-.31-.16-1.32-.48-2.51-1.54-.93-.82-1.56-1.84-1.74-2.15-.18-.31-.02-.48.14-.64.14-.14.31-.37.47-.55.16-.18.21-.31.31-.52.1-.21.05-.39-.03-.55-.08-.16-.71-1.7-.98-2.33-.26-.62-.52-.53-.71-.54h-.61c-.21 0-.55.08-.84.39-.29.31-1.1 1.07-1.1 2.61s1.13 3.03 1.29 3.24c.16.21 2.22 3.37 5.38 4.72.75.32 1.34.52 1.8.66.76.24 1.45.21 1.99.13.61-.09 1.85-.75 2.11-1.48.26-.73.26-1.35.18-1.48-.08-.13-.29-.21-.6-.37Z"
      />
    </svg>
  );
}

export default function MenuPage() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarMenu();
  }, []);

  async function cargarMenu() {
    try {
      const [productosRes, categoriasRes] = await Promise.all([
        api.get("/productos/menu"),
        api.get("/categorias"),
      ]);

      setProductos(productosRes.data.productos || []);
      setCategorias(categoriasRes.data.categorias || []);
    } catch {
      setMensaje("No se pudo cargar el menú.");
    }
  }

  function urlImagen(url) {
    if (!url) return "/logo.png";
    if (url.startsWith("http")) return url;
    return url;
  }

  const productosFiltrados = useMemo(() => {
    return productos.filter((producto) => {
      const categoriasProducto = producto.categorias || [];

      const coincideCategoria =
        categoriaActiva === "TODAS" ||
        categoriasProducto.some(
          (cat) => String(cat.id) === String(categoriaActiva)
        );

      const coincideBusqueda = producto.nombre
        .toLowerCase()
        .includes(busqueda.toLowerCase());

      return coincideCategoria && coincideBusqueda;
    });
  }, [productos, categoriaActiva, busqueda]);

  const categoriasConImagen = categorias.map((categoria) => {
    const producto = productos.find((p) =>
      (p.categorias || []).some((cat) => cat.id === categoria.id)
    );

    return {
      ...categoria,
      imagen: categoria.imagen_url || producto?.imagen_url || "/logo.png",
    };
  });

  return (
    <main className="premium-menu-page">
      <section className="menu-top-hero">
        <h1>Menú</h1>
        <p>
          Especialidades disponibles organizadas por categorías. Selecciona una
          categoría o busca tu antojo favorito.
        </p>
      </section>

      {mensaje && <div className="info-message">{mensaje}</div>}

      <section className="category-showcase">
        <button
          className={`category-showcase-card all ${
            categoriaActiva === "TODAS" ? "active" : ""
          }`}
          onClick={() => setCategoriaActiva("TODAS")}
        >
          <span>Todo</span>
          <strong>Menú completo</strong>
        </button>

        {categoriasConImagen.map((categoria) => (
          <button
            key={categoria.id}
            className={`category-showcase-card ${
              String(categoriaActiva) === String(categoria.id) ? "active" : ""
            }`}
            onClick={() => setCategoriaActiva(categoria.id)}
          >
            <img src={urlImagen(categoria.imagen)} alt={categoria.nombre} />
            <strong>{categoria.nombre}</strong>
          </button>
        ))}
      </section>

      <section className="premium-menu-content">
        <div className="premium-menu-toolbar">
          <h2>
            {categoriaActiva === "TODAS"
              ? "Todos los productos"
              : categorias.find((c) => String(c.id) === String(categoriaActiva))
                  ?.nombre}
          </h2>

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
          />
        </div>

        <div className="premium-product-grid">
          {productosFiltrados.map((producto) => {
            const precio = Number(producto.precio_venta || 0);
            const descuento = Number(producto.descuento_porcentaje || 0);
            const precioFinal = precio - precio * (descuento / 100);

            return (
              <article className="premium-product-card" key={producto.id}>
                <div className="premium-product-image">
                  <img src={urlImagen(producto.imagen_url)} alt={producto.nombre} />

                  {descuento > 0 && (
                    <span className="discount-label">
                      -{descuento}%
                    </span>
                  )}
                </div>

                <div className="premium-product-info">
                  <div className="product-category-tags">
                    {(producto.categorias || []).map((cat) => (
                      <span key={cat.id}>{cat.nombre}</span>
                    ))}
                  </div>

                  <h3>{producto.nombre}</h3>

                  <p>
                    {producto.descripcion || "Producto artesanal disponible."}
                  </p>

                  <div className="premium-price">
                    {descuento > 0 && (
                      <span>
                        ${precio.toLocaleString("es-CO")}
                      </span>
                    )}

                    <strong>
                      ${precioFinal.toLocaleString("es-CO")}
                    </strong>
                  </div>
                </div>
              </article>
            );
          })}

          {productosFiltrados.length === 0 && (
            <div className="empty-public-state">
              No hay productos disponibles en esta categoría.
            </div>
          )}
        </div>

        <div className="menu-whatsapp-cta">
          <a href={WHATSAPP_PEDIDO_URL} target="_blank" rel="noreferrer">
            <WhatsAppLogo />
            <span>Hacer pedido por WhatsApp</span>
          </a>
        </div>
      </section>
    </main>
  );
}
