import { useEffect, useState } from "react";
import api from "../../api/api.js";

export default function ConfiguracionFactura() {
  const [mensaje, setMensaje] = useState("");
  const [previewLogo, setPreviewLogo] = useState("");

  const [form, setForm] = useState({
    razon_social: "",
    nit: "",
    direccion: "",
    telefono: "",
    email: "",
    prefijo_factura: "POS",
    resolucion_dian: "",
    mensaje_inferior: "",
    logo: null,
    logo_url: "",
  });

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  async function cargarConfiguracion() {
    try {
      const { data } = await api.get("/configuracion-factura");

      if (data.configuracion) {
        setForm({
          ...data.configuracion,
          logo: null,
        });

        setPreviewLogo(data.configuracion.logo_url || "");
      }
    } catch {
      setMensaje("No se pudo cargar la configuración.");
    }
  }

  function handleChange(e) {
    const { name, value, type, files } = e.target;

    if (type === "file") {
      const file = files[0];

      setForm({
        ...form,
        logo: file,
      });

      if (file) {
        setPreviewLogo(URL.createObjectURL(file));
      }

      return;
    }

    setForm({
      ...form,
      [name]: value,
    });
  }

  function crearFormData() {
    const data = new FormData();

    data.append("razon_social", form.razon_social || "");
    data.append("nit", form.nit || "");
    data.append("direccion", form.direccion || "");
    data.append("telefono", form.telefono || "");
    data.append("email", form.email || "");
    data.append("prefijo_factura", form.prefijo_factura || "POS");
    data.append("resolucion_dian", form.resolucion_dian || "");
    data.append("mensaje_inferior", form.mensaje_inferior || "");

    if (form.logo) {
      data.append("logo", form.logo);
    }

    return data;
  }

  async function guardarConfiguracion(e) {
    e.preventDefault();
    setMensaje("");

    try {
      await api.put("/configuracion-factura", crearFormData(), {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMensaje("Configuración de factura POS actualizada.");
      cargarConfiguracion();
    } catch (error) {
      setMensaje(
        error.response?.data?.message ||
          "No se pudo guardar la configuración."
      );
    }
  }

  function urlLogo(url) {
    if (!url) return "/logo.png";
    if (url.startsWith("blob:")) return url;
    if (url.startsWith("http")) return url;
    return url;
  }

  return (
    <div>
      <div className="panel-card">
        <h2>Factura POS predeterminada</h2>

        <p>
          Esta configuración se usará para la factura POS impresa. La factura
          electrónica se implementará después con Factus.
        </p>

        {mensaje && <div className="info-message">{mensaje}</div>}

        <form className="admin-form" onSubmit={guardarConfiguracion}>
          <div className="form-grid">
            <label>
              Razón social
              <input
                name="razon_social"
                value={form.razon_social || ""}
                onChange={handleChange}
              />
            </label>

            <label>
              NIT
              <input
                name="nit"
                value={form.nit || ""}
                onChange={handleChange}
              />
            </label>

            <label>
              Teléfono
              <input
                name="telefono"
                value={form.telefono || ""}
                onChange={handleChange}
              />
            </label>

            <label>
              Email
              <input
                name="email"
                value={form.email || ""}
                onChange={handleChange}
              />
            </label>

            <label>
              Prefijo factura POS
              <input
                name="prefijo_factura"
                value={form.prefijo_factura || "POS"}
                onChange={handleChange}
              />
            </label>

            <label>
              Logo de factura
              <input
                type="file"
                name="logo"
                accept="image/*"
                onChange={handleChange}
              />
            </label>
          </div>

          {previewLogo && (
            <div>
              <p className="small-label">Logo actual / vista previa</p>
              <img
                src={urlLogo(previewLogo)}
                className="factura-logo-preview"
                alt="Logo factura"
              />
            </div>
          )}

          <label>
            Dirección
            <textarea
              name="direccion"
              value={form.direccion || ""}
              onChange={handleChange}
            />
          </label>

          <label>
            Resolución DIAN / texto legal POS
            <textarea
              name="resolucion_dian"
              value={form.resolucion_dian || ""}
              onChange={handleChange}
            />
          </label>

          <label>
            Mensaje inferior
            <textarea
              name="mensaje_inferior"
              value={form.mensaje_inferior || ""}
              onChange={handleChange}
              placeholder="Gracias por su compra"
            />
          </label>

          <button className="btn btn-primary">
            Guardar factura POS
          </button>
        </form>
      </div>

      <div className="panel-card receipt-preview">
        <h2>Vista previa POS</h2>

        <div className="receipt-box compact">
          {previewLogo && (
            <img
              src={urlLogo(previewLogo)}
              className="receipt-logo-preview"
              alt="Logo"
            />
          )}

          <strong>{form.razon_social || "Pan del Canasto"}</strong>
          <span>NIT: {form.nit || "000000000-0"}</span>
          <span>{form.direccion || "Dirección de la empresa"}</span>
          <span>Tel: {form.telefono || "Teléfono"}</span>

          <hr />

          <span>{form.prefijo_factura || "POS"}-000001</span>
          <span>Empleado: ejemplo</span>
          <span>Fecha: hora Colombia</span>

          <hr />

          <div className="receipt-row">
            <span>Roll New York x3</span>
            <span>$36.000</span>
          </div>

          <div className="receipt-row">
            <span>Subtotal</span>
            <span>$36.000</span>
          </div>

          <div className="receipt-row">
            <span>Propina 10%</span>
            <span>$3.600</span>
          </div>

          <div className="receipt-total">
            <span>Total</span>
            <strong>$39.600</strong>
          </div>

          <hr />

          <small>{form.resolucion_dian}</small>
          <p>{form.mensaje_inferior || "Gracias por su compra"}</p>
        </div>
      </div>
    </div>
  );
}
