import { useState } from "react";
import { searchMatchesByTeams, type Prediction } from "../api/client";
import { MatchCard } from "../components/MatchCard";

const EXAMPLES = [
  { home: "Spain", away: "Brazil", label: "Espana vs Brasil" },
  { home: "Argentina", away: "France", label: "Argentina vs Francia" },
  { home: "England", away: "Germany", label: "Inglaterra vs Alemania" },
];

export function ExplorePage() {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [results, setResults] = useState<Prediction[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!home.trim() && !away.trim()) return;
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const res = await searchMatchesByTeams({
        home: home.trim() || undefined,
        away: away.trim() || undefined,
        limit: 12,
      });
      setResults(res.items);
      setHint(res.hint ?? null);
      if (res.count === 0) {
        setError("No se encontraron partidos. Prueba en ingles: Spain, Brazil...");
      }
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Error de busqueda");
    } finally {
      setLoading(false);
    }
  }

  async function applyExample(h: string, a: string) {
    setHome(h);
    setAway(a);
    setLoading(true);
    setError(null);
    try {
      const res = await searchMatchesByTeams({ home: h, away: a, limit: 8 });
      setResults(res.items);
      if (res.count === 0) setError("Sin partidos para este enfrentamiento.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <span className="page-badge">Explorador</span>
        <h1>Buscar selecciones</h1>
        <p>
          Escribe el nombre de las selecciones (como en los datos: Spain, Brazil,
          Argentina...). No uses el ID numerico.
        </p>
      </header>

      <div className="search-hero">
        <form className="search-form" onSubmit={search}>
          <label>
            Local
            <input
              value={home}
              onChange={(e) => setHome(e.target.value)}
              placeholder="ej. Spain"
            />
          </label>
          <label>
            Visitante
            <input
              value={away}
              onChange={(e) => setAway(e.target.value)}
              placeholder="ej. Brazil"
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Buscando..." : "Buscar y predecir"}
          </button>
        </form>
      </div>

      <p className="examples-label">Ejemplos rapidos</p>
      <div className="chips">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            className="chip"
            onClick={() => {
              applyExample(ex.home, ex.away);
            }}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {error && <div className="alert">{error}</div>}
      {hint && !error && <p className="muted">{hint}</p>}

      {results.length > 0 && (
        <h2 className="section-title">
          Resultados ({results.length})
        </h2>
      )}

      <div className="match-list">
        {results.map((p) => (
          <MatchCard key={`${p.match_id}-${p.date}`} p={p} />
        ))}
      </div>
    </div>
  );
}
