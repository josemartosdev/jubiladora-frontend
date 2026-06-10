import { Link } from "react-router-dom";
import { ConfigPanel } from "../components/config/ConfigPanel";

export function ConfigPage() {
  return (
    <div className="page page--config">
      <header className="page-hero page-hero--config">
        <span className="wc-badge">Administración</span>
        <h1>Configuración</h1>
        <p className="muted">
          Entrena el modelo, ejecuta los scripts de carga y sincroniza datos para que
          pronósticos, apuestas y simulación funcionen.
        </p>
        <div className="hero-actions">
          <Link to="/predicciones" className="btn">
            Ir a pronósticos
          </Link>
          <Link to="/" className="btn">
            Volver al inicio
          </Link>
        </div>
      </header>

      <ConfigPanel />
    </div>
  );
}
