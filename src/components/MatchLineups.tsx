import type { LineupSide, MatchLineups } from "../api/client";

const POS_LABEL: Record<string, string> = {
  GK: "POR",
  DEF: "DEF",
  MID: "MED",
  FWD: "DEL",
};

function TeamXI({
  side,
  teamName,
  isOfficial,
}: {
  side: LineupSide;
  teamName: string;
  isOfficial: boolean;
}) {
  return (
    <div className="xi-team">
      <header className="xi-team-head">
        <h3>{teamName}</h3>
        <div className="xi-badges">
          <span className={`xi-badge ${isOfficial ? "official" : "probable"}`}>
            {isOfficial ? "11 oficial" : "11 habitual"}
          </span>
          {side.formation && (
            <span className="xi-formation">{side.formation}</span>
          )}
        </div>
      </header>
      <ol className="xi-list">
        {side.starters.map((p, i) => (
          <li key={`${p.name}-${i}`} className="xi-row">
            <span className="xi-row-num">{p.number ?? i + 1}</span>
            <span className="xi-row-pos">{POS_LABEL[p.position] ?? p.position}</span>
            <span className="xi-row-name">{p.name}</span>
            {p.projection && (
              <span className="xi-row-hint">
                Gol {p.projection.goal_level} {p.projection.goal_pct}%
              </span>
            )}
          </li>
        ))}
      </ol>
      {side.substitutes.length > 0 && (
        <details className="xi-subs">
          <summary>Suplentes ({side.substitutes.length})</summary>
          <ul className="xi-subs-list">
            {side.substitutes.map((p) => (
              <li key={p.name}>
                <span className="xi-row-num">{p.number ?? "—"}</span> {p.name}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function MatchLineups({ lineups }: { lineups: MatchLineups }) {
  return (
    <section className="card lineups-section">
      <h2>Alineaciones</h2>
      <p className="muted small">{lineups.legend}</p>
      {lineups.fetch_hint && <p className="muted small">{lineups.fetch_hint}</p>}
      <div className="xi-cols">
        <TeamXI
          side={lineups.home}
          teamName={lineups.home_team}
          isOfficial={lineups.home_is_official}
        />
        <TeamXI
          side={lineups.away}
          teamName={lineups.away_team}
          isOfficial={lineups.away_is_official}
        />
      </div>
    </section>
  );
}
