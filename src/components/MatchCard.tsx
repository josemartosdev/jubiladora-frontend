import { Link } from "react-router-dom";
import type { Prediction, Probabilities } from "../api/client";
import {
  formatKickoffTimeEs,
  formatMatchDateShortEs,
} from "../lib/datetimeEs";
import { ProbBars } from "./ProbBars";

const MODE_LABEL: Record<string, string> = {
  ml_elo: "ML + Elo",
  db_form: "BD forma",
  db_h2h: "BD + H2H",
  db_prior: "BD prior",
};

const PICK_LABEL: Record<string, string> = {
  home: "Victoria local",
  draw: "Empate",
  away: "Victoria visitante",
};

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase();
}

function ProbPills({
  probs,
  highlight,
}: {
  probs: Probabilities;
  highlight?: keyof Probabilities;
}) {
  const rows: { key: keyof Probabilities; label: string; cls: string }[] = [
    { key: "home", label: "1", cls: "home" },
    { key: "draw", label: "X", cls: "draw" },
    { key: "away", label: "2", cls: "away" },
  ];
  return (
    <div className="prob-pills">
      {rows.map(({ key, label, cls }) => (
        <span
          key={key}
          className={`prob-pill ${cls} ${highlight === key ? "active" : ""}`}
        >
          {label} {(probs[key] * 100).toFixed(0)}%
        </span>
      ))}
    </div>
  );
}

export function MatchCard({
  p,
  compact,
  featured,
}: {
  p: Prediction;
  compact?: boolean;
  featured?: boolean;
}) {
  const hasPrediction = p.has_prediction !== false && p.confidence > 0;
  const modeLabel = p.inference_mode ? MODE_LABEL[p.inference_mode] ?? p.inference_mode : null;
  const pickLabel = PICK_LABEL[p.pick] ?? p.pick;
  const confPct = Math.round(p.confidence * 100);
  const kickoff = formatKickoffTimeEs(p.date, p.kickoff_at);
  const dateLabel = formatMatchDateShortEs(p.date, p.kickoff_at);

  const correct =
    p.has_result &&
    p.actual_result &&
    ((p.pick === "home" && p.actual_result === "1") ||
      (p.pick === "draw" && p.actual_result === "X") ||
      (p.pick === "away" && p.actual_result === "2"));

  const cardClass = [
    "match-card",
    compact ? "compact" : "",
    featured ? "featured" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClass}>
      <header className="match-head">
        <div>
          <time className="match-card-time">
            {dateLabel}
            {kickoff && <span className="match-card-kickoff">{kickoff} (ES)</span>}
            {p.is_future && <span className="future-tag">FUTURO</span>}
          </time>
          <div className="match-teams-row">
            <div className="team-block home">
              <span className="team-crest" aria-hidden>
                {teamInitials(p.home_team)}
              </span>
              <span className="team-name">{p.home_team}</span>
            </div>
            <span className="vs-badge">VS</span>
            <div className="team-block away">
              <span className="team-crest" aria-hidden>
                {teamInitials(p.away_team)}
              </span>
              <span className="team-name">{p.away_team}</span>
            </div>
          </div>
          {p.tournament && <p className="tournament">{p.tournament}</p>}
        </div>
        {hasPrediction ? (
          <div className="pick-badge">
            {featured && (
              <div className="conf-ring-wrap">
                <div
                  className="conf-ring"
                  style={{ "--pct": confPct } as React.CSSProperties}
                  title={`${confPct}% confianza`}
                >
                  <span>{confPct}%</span>
                </div>
              </div>
            )}
            <small>Pick modelo</small>
            <strong>{pickLabel}</strong>
            {!featured && (
              <span>{confPct}% conf.</span>
            )}
            {modeLabel && <span className="mode-tag">{modeLabel}</span>}
          </div>
        ) : (
          <div className="pick-badge muted-badge">
            <small>Sin Elo</small>
            <strong>Sin prediccion</strong>
          </div>
        )}
      </header>
      {!compact && hasPrediction && (
        <>
          <ProbBars probs={p.probabilities} highlight={p.pick} />
          <p className="muted small card-hint">
            Ficha pro: goles, corners, faltas, BTTS y 14+ mercados
          </p>
        </>
      )}
      {compact && hasPrediction && (
        <ProbPills probs={p.probabilities} highlight={p.pick} />
      )}
      {p.external_fixture_id && (
        <p className="match-link">
          <Link to={`/partido/${p.external_fixture_id}`}>Ver ficha completa →</Link>
        </p>
      )}
      <footer className="match-foot">
        {p.home_elo != null && p.away_elo != null && (
          <span>
            Elo {Math.round(p.home_elo)} — {Math.round(p.away_elo)} (Δ{" "}
            {Math.round(p.elo_diff ?? 0)})
          </span>
        )}
        {p.has_result && (
          <span className={correct ? "hit" : "miss"}>
            Resultado {p.home_goals}-{p.away_goals} ({p.actual_result})
            {correct ? " ✓ acierto" : " ✗"}
          </span>
        )}
      </footer>
    </article>
  );
}
