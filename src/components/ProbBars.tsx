import type { Probabilities } from "../api/client";

const LABELS: { key: keyof Probabilities; label: string; color: string }[] = [
  { key: "home", label: "1 Local", color: "var(--home)" },
  { key: "draw", label: "X Empate", color: "var(--draw)" },
  { key: "away", label: "2 Visitante", color: "var(--away)" },
];

export function ProbBars({
  probs,
  highlight,
}: {
  probs: Probabilities;
  highlight?: keyof Probabilities;
}) {
  return (
    <div className="prob-bars">
      {LABELS.map(({ key, label, color }) => {
        const pct = probs[key] * 100;
        const active = highlight === key;
        return (
          <div key={key} className={`prob-row ${active ? "active" : ""}`}>
            <div className="prob-meta">
              <span>{label}</span>
              <strong>{pct.toFixed(1)}%</strong>
            </div>
            <div className="prob-track">
              <div
                className="prob-fill"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
