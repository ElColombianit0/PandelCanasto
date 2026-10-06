export default function UbicacionPage() {
  const direccion = "Cl. 15 #47-77, La Esperanza, Villavicencio, Meta";
  const mapsQuery = encodeURIComponent(`${direccion}, Colombia`);

  return (
    <main className="public-page">
      <section className="public-hero-small">
        <span className="eyebrow">Ubicación</span>
        <h1>Encuéntranos</h1>
        <p>
          Visítanos y disfruta nuestras especialidades recién preparadas.
        </p>
      </section>

      <section className="public-content-card">
        <h2>Dirección</h2>
        <p>{direccion}</p>

        <div className="google-map-card">
          <iframe
            title="Ubicación Pan del Canasto"
            src={`https://www.google.com/maps?q=${mapsQuery}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>

        <a
          className="btn btn-primary map-link-button"
          href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
          target="_blank"
          rel="noreferrer"
        >
          Abrir en Google Maps
        </a>
      </section>
    </main>
  );
}
