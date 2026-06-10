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
  home: "1 Local",
  draw: "X Empate",
  away: "2 Visit.",
};

const PICK_SHORT: Record<string, string> = {
  home: "1",
  draw: "X",
  away: "2",
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
    <div className="prob-pills match-card-probs">
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
  const pickShort = PICK_SHORT[p.pick] ?? "?";
  const confPct = Math.round(p.confidence * 100);
  const kickoff = formatKickoffTimeEs(p.date, p.kickoff_at);
  const dateLabel = formatMatchDateShortEs(p.date, p.kickoff_at);
  const isLive = p.status === "live";

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
    isLive ? "is-live" : "",
    hasPrediction ? "has-pred" : "no-pred",
  ]
    .filter(Boolean)
    .join(" ");

  const matchId = p.external_fixture_id ?? p.match_id;

  return (
    <article className={cardClass}>
      <div className="match-card-top">
        <div className="match-card-meta">
          <time className="match-card-date">{dateLabel}</time>
          {kickoff && <span className="match-card-time">{kickoff}</span>}
          {isLive && <span className="live-tag">LIVE</span>}
          {p.is_future && !isLive && <span className="future-tag">FUTURO</span>}
        </div>
        {p.tournament && (
          <span className="match-card-tournament">{p.tournament}</span>
        )}
      </div>

      <div className="match-card-body">
        <div className="match-card-team home">
          <span className="team-crest team-crest--home" aria-hidden>
            {teamInitials(p.home_team)}
          </span>
          <span className="team-name">{p.home_team}</span>
        </div>

        <div className="match-card-center">
          {hasPrediction ? (
            <div className="match-card-pick" title={pickLabel}>
              <span className="match-card-pick-label">Pick</span>
              <strong className="match-card-pick-value">{pickShort}</strong>
              <span className="match-card-conf">{confPct}%</span>
            </div>
          ) : (
            <span className="match-card-vs">VS</span>
          )}
          {kickoff && compact && (
            <span className="match-card-kickoff-mini">{kickoff}</span>
          )}
        </div>

        <div className="match-card-team away">
          <span className="team-crest team-crest--away" aria-hidden>
            {teamInitials(p.away_team)}
          </span>
          <span className="team-name">{p.away_team}</span>
        </div>
      </div>

      {compact && hasPrediction && (
        <ProbPills probs={p.probabilities} highlight={p.pick} />
      )}

      {!compact && hasPrediction && (
        <ProbBars probs={p.probabilities} highlight={p.pick} />
      )}

      <footer className="match-card-foot">
        <div className="match-card-foot-left">
          {modeLabel && <span className="mode-tag">{modeLabel}</span>}
          {p.home_elo != null && p.away_elo != null && (
            <span className="match-elo muted small">
              Elo {Math.round(p.home_elo)}–{Math.round(p.away_elo)}
            </span>
          )}
          {p.has_result && (
            <span className={correct ? "hit" : "miss"}>
              {p.home_goals}-{p.away_goals} ({p.actual_result})
            </span>
          )}
        </div>
        {matchId > 0 && (
          <Link to={`/partido/${matchId}`} className="match-card-cta">
            Ver ficha →
          </Link>
        )}
      </footer>

      {featured && hasPrediction && (
        <div className="match-card-featured-badge">
          Mejor pick · {pickLabel} · {confPct}%
        </div>
      )}
    </article>
  );
}
