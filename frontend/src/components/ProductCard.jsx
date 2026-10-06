export default function ProductCard({ producto }) {
  const precio = Number(producto.precio || 0);
  const descuento = Number(producto.descuento || 0);
  const precioFinal = precio - precio * (descuento / 100);

  return (
    <article className="product-card">
      <img src={producto.imagen} alt={producto.nombre} />

      <div className="product-content">
        {descuento > 0 && <span className="discount-badge">-{descuento}%</span>}

        <h3>{producto.nombre}</h3>

        <p>{producto.descripcion}</p>

        <div className="product-price">
          {descuento > 0 && (
            <span className="old-price">${precio.toLocaleString("es-CO")}</span>
          )}

          <strong>${precioFinal.toLocaleString("es-CO")}</strong>
        </div>
      </div>
    </article>
  );
}