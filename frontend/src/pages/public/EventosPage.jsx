export default function EventosPage() {
  return (
    <main className="public-page">
      <section className="public-hero-small">
        <span className="eyebrow">Eventos</span>
        <h1>Especialidades para tus momentos importantes</h1>
        <p>
          Solicita productos para cumpleaños, reuniones, eventos empresariales y
          celebraciones.
        </p>
      </section>

      <section className="public-content-card">
        <h2>Solicitar reserva</h2>

        <form className="event-form public-form">
          <input type="text" placeholder="Nombre completo" />
          <input type="tel" placeholder="Teléfono" />
          <input type="email" placeholder="Correo electrónico" />
          <input type="date" />
          <textarea placeholder="Cuéntanos sobre tu evento"></textarea>

          <button type="button" className="btn btn-primary">
            Enviar solicitud
          </button>
        </form>
      </section>
    </main>
  );
}
