import { Link } from "react-router-dom";
import { toErrorDisplay } from "../lib/apiError";

export function ErrorAlert({
  error,
  className = "",
}: {
  error: unknown;
  className?: string;
}) {
  const d = toErrorDisplay(error);

  return (
    <div className={`error-alert ${className}`.trim()} role="alert">
      <header className="error-alert-head">
        <span className="error-alert-code">{d.status ?? "!"}</span>
        <div>
          <strong className="error-alert-title">{d.title}</strong>
          {d.statusLabel && (
            <p className="error-alert-status-label">{d.statusLabel}</p>
          )}
        </div>
      </header>

      {d.path && (
        <div className="error-alert-row">
          <span className="error-alert-label">Endpoint</span>
          <code className="error-alert-path">{d.path}</code>
        </div>
      )}

      <div className="error-alert-row">
        <span className="error-alert-label">Detalle</span>
        <p className="error-alert-detail">{d.detail}</p>
      </div>

      {d.hint && (
        <div className="error-alert-hint">
          <strong>Qué puedes hacer</strong>
          <p>{d.hint}</p>
          <p className="error-alert-links">
            <Link to="/configuracion">Ir a Configuración</Link>
            {" · "}
            <a
              href="http://127.0.0.1:8888/api/docs"
              target="_blank"
              rel="noreferrer"
            >
              API docs
            </a>
          </p>
        </div>
      )}

      {d.raw && d.raw !== d.detail && (
        <details className="error-alert-raw">
          <summary>Respuesta cruda del servidor</summary>
          <pre>{d.raw}</pre>
        </details>
      )}
    </div>
  );
}
