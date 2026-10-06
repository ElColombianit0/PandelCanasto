import { useEffect, useState } from "react";
import api from "../../api/api.js";

const formInicial = {
  titulo: "",
  subtitulo: "",
  boton_texto: "",
  boton_link: "/menu",
  orden: 0,
  activo: true,
  mostrar_informacion: false,
  imagen: null,
};

function esVerdadero(valor) {
  return valor === true || valor === "true" || valor === 1;
}

export default function PaginaPublicaAdmin() {
  const [banners, setBanners] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [preview, setPreview] = useState("");
  const [form, setForm] = useState(formInicial);

  useEffect(() => {
    cargarBanners();
  }, []);

  async function cargarBanners() {
    try {
      const { data } = await api.get("/configuracion-sitio/banners");
      setBanners(data.banners || []);
    } catch {
      setMensaje("No se pudieron cargar los banners.");
    }
  }

  function limpiarForm() {
    setForm(formInicial);
    setPreview("");
    setEditandoId(null);
  }

  function handleChange(e) {
    const { name, value, type, checked, files } = e.target;

    if (type === "file") {
      const file = files[0] || null;

      setForm({
        ...form,
        imagen: file,
      });

      if (file) {
        setPreview(URL.createObjectURL(file));
      }

      return;
    }

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  }

  function crearFormData() {
    const data = new FormData();

    data.append("titulo", form.titulo || "");
    data.append("subtitulo", form.subtitulo || "");
    data.append("boton_texto", form.boton_texto || "");
    data.append("boton_link", form.boton_link || "");
    data.append("orden", form.orden || 0);
    data.append("activo", form.activo);
    data.append("mostrar_informacion", form.mostrar_informacion);

    if (form.imagen) {
      data.append("imagen", form.imagen);
    }

    return data;
  }

  async function guardarBanner(e) {
    e.preventDefault();
    setMensaje("");

    try {
      const data = crearFormData();
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      };

      if (editandoId) {
        await api.put(`/configuracion-sitio/banners/${editandoId}`, data, config);
        setMensaje("Banner actualizado correctamente.");
      } else {
        await api.post("/configuracion-sitio/banners", data, config);
        setMensaje("Banner creado correctamente.");
      }

      limpiarForm();
      cargarBanners();
    } catch {
      setMensaje("No se pudo guardar el banner.");
    }
  }

  function editarBanner(banner) {
    setEditandoId(banner.id);

    setForm({
      titulo: banner.titulo || "",
      subtitulo: banner.subtitulo || "",
      boton_texto: banner.boton_texto || "",
      boton_link: banner.boton_link || "/menu",
      orden: banner.orden || 0,
      activo: esVerdadero(banner.activo),
      mostrar_informacion: esVerdadero(banner.mostrar_informacion),
      imagen: null,
    });

    setPreview(banner.imagen_url || "");
  }

  async function eliminarBanner(id) {
    if (!confirm("¿Seguro que quieres eliminar este banner?")) return;

    try {
      await api.delete(`/configuracion-sitio/banners/${id}`);
      setMensaje("Banner eliminado.");
      cargarBanners();
    } catch {
      setMensaje("No se pudo eliminar el banner.");
    }
  }

  function urlImagen(url) {
    if (!url) return "/logo.png";
    if (url.startsWith("blob:")) return url;
    if (url.startsWith("http")) return url;
    return url;
  }

  return (
    <div>
      {mensaje && <div className="info-message">{mensaje}</div>}

      <div className="panel-card">
        <h2>{editandoId ? "Editar banner del carrusel" : "Crear banner del carrusel"}</h2>

        <p>
          Estos banners aparecen en la página principal. Cada banner puede mostrar solo
          la imagen o incluir logo, título, texto y botón.
        </p>

        <form className="admin-form" onSubmit={guardarBanner}>
          <div className="form-grid">
            <label>
              Título
              <input
                name="titulo"
                value={form.titulo}
                onChange={handleChange}
                placeholder="Para esta temporada, disfrutar es compartir la mesa"
                required
              />
            </label>

            <label>
              Texto botón
              <input
                name="boton_texto"
                value={form.boton_texto}
                onChange={handleChange}
                placeholder="Ver menú"
              />
            </label>

            <label>
              Link botón
              <input
                name="boton_link"
                value={form.boton_link}
                onChange={handleChange}
                placeholder="/menu"
              />
            </label>

            <label>
              Orden
              <input
                type="number"
                name="orden"
                value={form.orden}
                onChange={handleChange}
              />
            </label>

            <label>
              Imagen del carrusel
              <input
                type="file"
                name="imagen"
                accept="image/*"
                onChange={handleChange}
              />
            </label>
          </div>

          <label>
            Subtítulo
            <textarea
              name="subtitulo"
              value={form.subtitulo}
              onChange={handleChange}
              placeholder="Especialidades artesanales, frescas y hechas para compartir."
            />
          </label>

          {preview && (
            <div>
              <p className="small-label">Vista previa</p>
              <img src={urlImagen(preview)} className="banner-preview-large" alt="Vista previa" />
            </div>
          )}

          <label className="checkbox-inline">
            <input
              type="checkbox"
              name="mostrar_informacion"
              checked={form.mostrar_informacion}
              onChange={handleChange}
            />
            Mostrar logo, título, texto y botón sobre este banner
          </label>

          <label className="checkbox-inline">
            <input
              type="checkbox"
              name="activo"
              checked={form.activo}
              onChange={handleChange}
            />
            Banner activo
          </label>

          <div className="action-row">
            <button className="btn btn-primary">
              {editandoId ? "Actualizar banner" : "Crear banner"}
            </button>

            {editandoId && (
              <button type="button" className="btn btn-outline" onClick={limpiarForm}>
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="panel-card">
        <h2>Banners registrados</h2>

        <div className="banner-grid">
          {banners.map((banner) => (
            <div className="banner-card" key={banner.id}>
              <img src={urlImagen(banner.imagen_url)} alt={banner.titulo} />

              <div className="banner-card-body">
                <h3>{banner.titulo}</h3>
                <p>{banner.subtitulo}</p>
                <p>
                  <strong>Orden:</strong> {banner.orden} ·{" "}
                  <strong>Activo:</strong> {esVerdadero(banner.activo) ? "Sí" : "No"}
                </p>
                <p>
                  <strong>Información adicional:</strong>{" "}
                  {esVerdadero(banner.mostrar_informacion) ? "Sí" : "No"}
                </p>

                <div className="action-row">
                  <button className="mini-button" onClick={() => editarBanner(banner)}>
                    Editar
                  </button>

                  <button
                    className="mini-button danger"
                    onClick={() => eliminarBanner(banner.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}

          {banners.length === 0 && <p>No hay banners creados todavía.</p>}
        </div>
      </div>
    </div>
  );
}
