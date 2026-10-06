import { Mail, MapPin, Phone } from "lucide-react";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8Zm8.95 2.15a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 7.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 2a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M14 8.2V6.7c0-.7.46-.9.78-.9H17V2h-3.05C10.56 2 9.8 4.54 9.8 6.17V8.2H7v3.9h2.8V22H14v-9.9h3.13l.42-3.9H14Z"
      />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M16.4 2c.32 2.42 1.68 3.86 4.1 4.02v3.42a7.26 7.26 0 0 1-4.08-1.2v6.36c0 4.2-2.75 7.4-6.73 7.4A6.17 6.17 0 0 1 3.5 15.8c0-3.55 2.9-6.33 6.9-6.05v3.58c-1.86-.28-3.26.68-3.26 2.5a2.5 2.5 0 0 0 2.48 2.58c1.74 0 2.8-1.08 2.8-3.14V2h3.98Z"
      />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="footer" id="contacto">
      <div className="footer-grid">
        <div>
          <img src="/logo.png" alt="Pan del Canasto" className="footer-logo" />
          <p>
            Panadería artesanal y Restaurante gourmet 100% llanero con calidad
            y tradición por mas de 30 años
          </p>
        </div>

        <div>
          <h3>Contacto</h3>

          <p className="footer-line">
            <Phone size={18} />
            +57 314 3848277
          </p>

          <p className="footer-line">
            <Mail size={18} />
            contactopandelcanasto@gmail.com
          </p>

          <p className="footer-line">
            <MapPin size={18} />
            Calle 15 #47-77
          </p>
        </div>

        <div>
          <h3>Redes sociales</h3>

          <div className="socials">
            <a
              href="https://www.instagram.com/pandelcanasto/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram de Pan del Canasto"
              title="Instagram"
            >
              <InstagramIcon />
            </a>

            <a
              href="https://www.tiktok.com/@pandelcanasto"
              target="_blank"
              rel="noreferrer"
              aria-label="TikTok de Pan del Canasto"
              title="TikTok"
            >
              <TikTokIcon />
            </a>

            <a
              href="https://www.facebook.com/pandelcanasto"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook de Pan del Canasto"
              title="Facebook"
            >
              <FacebookIcon />
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        © {new Date().getFullYear()} Pan del Canasto. Todos los derechos reservados.
      </div>
    </footer>
  );
}
