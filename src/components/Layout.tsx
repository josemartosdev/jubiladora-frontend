import { NavLink, Outlet } from "react-router-dom";
import { API_URL } from "../api/client";
import { useAppClock } from "../context/AppClockContext";

const links = [
  { to: "/", label: "Inicio", icon: "⌂" },
  { to: "/apuestas", label: "Apuestas", icon: "€" },
  { to: "/calendario", label: "Calendario", icon: "📅" },
  { to: "/predicciones", label: "Predicciones", icon: "◎" },
  { to: "/explorar", label: "Buscar selecciones", icon: "🔍" },
];

export function Layout({ online }: { online: boolean | null }) {
  const { displayLabel, todayIso } = useAppClock();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">J</span>
          <div>
            <strong>Jubiladora</strong>
            <small>Pro · Simulacion · Apuestas</small>
          </div>
        </div>
        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) => (isActive ? "nav active" : "nav")}
            >
              <span className="nav-icon" aria-hidden>
                {l.icon}
              </span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>
            <span className={`dot ${online ? "on" : "off"}`} />
            {online === null ? "Comprobando API…" : online ? "API online" : "API offline"}
          </span>
          <a
            href={API_URL ? `${API_URL}/api/docs` : "http://127.0.0.1:8888/api/docs"}
            target="_blank"
            rel="noreferrer"
          >
            Documentacion API →
          </a>
        </div>
      </aside>
      <main className="main">
        <div className="dashboard-clock" role="status" aria-live="polite">
          <span className="dashboard-clock-label">Referencia Jubiladora</span>
          <strong>{displayLabel}</strong>
          <span className="dashboard-clock-today muted small">Hoy: {todayIso}</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
