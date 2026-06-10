import type { PlayerAchievement } from "../../lib/tournamentSim";

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts.at(-1)![0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function AchievementCard({ a, featured }: { a: PlayerAchievement; featured?: boolean }) {
  return (
    <article className={`achievement-card achievement-card--${a.tier} ${featured ? "featured" : ""}`}>
      <div className="achievement-icon-wrap">
        <span className="achievement-icon" aria-hidden>
          {a.icon}
        </span>
      </div>
      <div className="achievement-body">
        <span className="achievement-title">{a.title}</span>
        <span className="achievement-subtitle muted small">{a.subtitle}</span>
        <div className="achievement-player-row">
          <span className="achievement-crest">{teamInitials(a.team)}</span>
          <div>
            <strong className="achievement-player">{a.player}</strong>
            <span className="achievement-team muted small">{a.team}</span>
          </div>
        </div>
        <div className="achievement-foot">
          <span className="achievement-stat">{a.stat}</span>
          {a.probability > 0 && (
            <span className="achievement-prob">{a.probability}% modelo</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function PlayerAchievements({ items }: { items: PlayerAchievement[] }) {
  const [headline, ...rest] = items;

  return (
    <div className="achievements-board">
      {headline && (
        <div className="achievements-headline">
          <AchievementCard a={headline} featured />
        </div>
      )}
      <div className="achievements-grid">
        {rest.map((a) => (
          <AchievementCard key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}
