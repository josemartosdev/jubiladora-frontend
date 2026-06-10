import { NavLink, Outlet } from "react-router-dom";
import { API_URL } from "../api/client";

const links = [
  { to: "/", label: "Mundial" },
  { to: "/predicciones", label: "Pronósticos" },
  { to: "/simulacion", label: "Simulación" },
  { to: "/apuestas", label: "Apuestas" },
  { to: "/calendario", label: "Calendario" },
  { to: "/configuracion", label: "Configuración" },
];

export function Layout({ online }: { online: boolean | null }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">J</span>
          <div>
            <strong>Jubiladora</strong>
            <small>Mundial 2026 · Pronósticos</small>
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
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>
            <span className={`dot ${online ? "on" : "off"}`} />
            {online === null ? "Comprobando…" : online ? "API online" : "API offline"}
          </span>
          <a
            href={API_URL ? `${API_URL}/api/docs` : "http://127.0.0.1:8888/api/docs"}
            target="_blank"
            rel="noreferrer"
          >
            API docs →
          </a>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
