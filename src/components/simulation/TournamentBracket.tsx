import type { CSSProperties } from "react";
import { WC_QUALIFIERS, WC_TOTAL_TEAMS } from "../../lib/tournamentSim";
import type { BracketColumn, SimMatch } from "../../lib/tournamentSim";

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts.at(-1)![0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function BracketMatch({ match, size }: { match: SimMatch; size: "sm" | "md" | "lg" }) {
  const homeWon = match.winner === match.home;
  const awayWon = match.winner === match.away;

  return (
    <article className={`bracket-match bracket-match--${size}`}>
      <div className={`bracket-slot ${homeWon ? "winner" : "loser"}`}>
        <span className="bracket-crest">{teamInitials(match.home)}</span>
        <span className="bracket-team">{match.home}</span>
        {homeWon && <span className="bracket-check">✓</span>}
      </div>
      <div className="bracket-score-row">
        <span className="bracket-score">{match.score}</span>
      </div>
      <div className={`bracket-slot ${awayWon ? "winner" : "loser"}`}>
        <span className="bracket-crest">{teamInitials(match.away)}</span>
        <span className="bracket-team">{match.away}</span>
        {awayWon && <span className="bracket-check">✓</span>}
      </div>
    </article>
  );
}

function BracketColumnView({
  column,
  roundIndex,
  totalRounds,
}: {
  column: BracketColumn;
  roundIndex: number;
  totalRounds: number;
}) {
  const isFinal = column.id === "FINAL";
  const size = isFinal ? "lg" : column.matches.length <= 4 ? "md" : "sm";
  const gapScale = Math.pow(2, roundIndex);

  return (
    <div
      className={`bracket-column ${isFinal ? "bracket-column--final" : ""}`}
      style={{ "--bracket-gap": `${gapScale * 0.45}rem` } as CSSProperties}
    >
      <header className="bracket-column-head">
        <span className="bracket-round-badge">{column.shortLabel}</span>
        <span className="bracket-round-label">{column.label}</span>
        <span className="bracket-round-count muted small">
          {column.matches.length} {column.matches.length === 1 ? "partido" : "partidos"}
        </span>
      </header>
      <div className="bracket-column-matches">
        {column.matches.map((m) => (
          <div key={m.code} className="bracket-match-wrap">
            <BracketMatch match={m} size={size} />
            {roundIndex < totalRounds - 1 && <span className="bracket-connector" aria-hidden />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TournamentBracket({
  groupAllTeams,
  groupQualifiers,
  groupEliminated,
  bracket,
  champion,
  runnerUp,
}: {
  groupAllTeams: string[];
  groupQualifiers: string[];
  groupEliminated: string[];
  bracket: BracketColumn[];
  champion: string;
  runnerUp: string;
}) {
  const qualifiedSet = new Set(groupQualifiers);
  const total = groupAllTeams.length || WC_TOTAL_TEAMS;
  const qualified = groupQualifiers.length || WC_QUALIFIERS;

  return (
    <div className="bracket-board">
      <section className="card bracket-summary">
        <div className="bracket-summary-flow">
          <div className="bracket-summary-step">
            <span className="bracket-summary-num">{total}</span>
            <span className="muted small">Equipos en grupos</span>
          </div>
          <span className="bracket-summary-arrow">→</span>
          <div className="bracket-summary-step highlight">
            <span className="bracket-summary-num">{qualified}</span>
            <span className="muted small">Clasificados</span>
          </div>
          <span className="bracket-summary-arrow">→</span>
          <div className="bracket-summary-step">
            <span className="bracket-summary-num">1</span>
            <span className="muted small">Campeón</span>
          </div>
        </div>
      </section>

      <section className="bracket-groups-panel card">
        <header className="bracket-groups-head">
          <span className="bracket-round-badge">48→32</span>
          <div>
            <h3 className="bracket-groups-title">Fase de grupos — clasificación</h3>
            <p className="muted small">
              {qualified} de {total} selecciones pasan a dieciseisavos (formato Mundial 2026)
            </p>
          </div>
        </header>

        <h4 className="bracket-subtitle">Clasificados ({qualified})</h4>
        <div className="bracket-groups-grid bracket-groups-grid--qualified">
          {groupQualifiers.map((team) => (
            <div key={team} className="bracket-group-team qualified">
              <span className="bracket-crest sm">{teamInitials(team)}</span>
              <span className="bracket-team-name">{team}</span>
              <span className="bracket-pass">✓</span>
            </div>
          ))}
        </div>

        {groupEliminated.length > 0 && (
          <>
            <h4 className="bracket-subtitle eliminated">
              Eliminados en grupos ({groupEliminated.length})
            </h4>
            <div className="bracket-groups-grid bracket-groups-grid--out">
              {groupEliminated.map((team) => (
                <div key={team} className="bracket-group-team eliminated">
                  <span className="bracket-crest sm">{teamInitials(team)}</span>
                  <span className="bracket-team-name">{team}</span>
                  <span className="bracket-out">✗</span>
                </div>
              ))}
            </div>
          </>
        )}

        {groupAllTeams.length > 0 && groupQualifiers.length === 0 && (
          <div className="bracket-groups-grid">
            {groupAllTeams.map((team) => (
              <div
                key={team}
                className={`bracket-group-team ${qualifiedSet.has(team) ? "qualified" : ""}`}
              >
                <span className="bracket-crest sm">{teamInitials(team)}</span>
                <span>{team}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="bracket-knockout-wrap">
        <h3 className="bracket-knockout-title">Cuadro eliminatorio</h3>
        <p className="bracket-flow-hint muted small">
          16 partidos en 1/16 → 8 en 1/8 → 4 cuartos → 2 semis → final
        </p>
        <div className="bracket-knockout-scroll">
          <div className="bracket-knockout">
            {bracket.map((col, i) => (
              <BracketColumnView
                key={col.id}
                column={col}
                roundIndex={i}
                totalRounds={bracket.length}
              />
            ))}
          </div>
        </div>
      </div>

      <footer className="bracket-podium card">
        <div className="bracket-podium-slot second">
          <span className="bracket-podium-medal">🥈</span>
          <strong>{runnerUp}</strong>
          <span className="muted small">Subcampeón</span>
        </div>
        <div className="bracket-podium-slot first">
          <span className="bracket-podium-trophy">🏆</span>
          <strong>{champion}</strong>
          <span className="muted small">Campeón del Mundial</span>
        </div>
        <div className="bracket-podium-slot third placeholder">
          <span className="bracket-podium-medal">🥉</span>
          <strong>—</strong>
          <span className="muted small">Tercer puesto</span>
        </div>
      </footer>
    </div>
  );
}
