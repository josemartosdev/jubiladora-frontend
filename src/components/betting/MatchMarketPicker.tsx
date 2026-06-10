import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getBettingMatchMarkets,
  type BettingDayMatch,
  type BettingMatchMarketsResponse,
  type BettingSelection,
} from "../../api/client";
import { formatKickoffTimeEs } from "../../lib/datetimeEs";
import { ErrorAlert } from "../ErrorAlert";

function MarketButton({
  sel,
  inSlip,
  onAdd,
}: {
  sel: BettingSelection;
  inSlip: boolean;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      className={`market-sel-btn ${inSlip ? "in-slip" : ""} ${sel.recommended ? "recommended" : ""}`}
      onClick={onAdd}
    >
      <span className="market-sel-name">{sel.selection}</span>
      <span className="market-sel-meta">
        <span className="bet-odd">@{sel.decimal_odds.toFixed(2)}</span>
        <span className="muted small">
          {(sel.model_probability * 100).toFixed(0)}%
        </span>
      </span>
    </button>
  );
}

export function MatchMarketPicker({
  matches,
  dayLabel,
  slipIds,
  onAdd,
}: {
  matches: BettingDayMatch[];
  dayLabel: string;
  slipIds: Set<string>;
  onAdd: (match: BettingDayMatch, sel: BettingSelection) => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [markets, setMarkets] = useState<BettingMatchMarketsResponse | null>(null);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [marketError, setMarketError] = useState<unknown>(null);

  const selectedMatch = matches.find((m) => m.match_id === selectedId) ?? null;

  useEffect(() => {
    if (matches.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev != null && matches.some((m) => m.match_id === prev)) return prev;
      return matches[0].match_id;
    });
  }, [matches]);

  const loadMarkets = useCallback(async (matchId: number) => {
    setLoadingMarkets(true);
    setMarketError(null);
    try {
      const res = await getBettingMatchMarkets(matchId);
      if (res.status !== "ok") {
        throw new Error("No se pudieron cargar los mercados del partido");
      }
      setMarkets(res);
    } catch (e) {
      setMarketError(e);
      setMarkets(null);
    } finally {
      setLoadingMarkets(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId == null) {
      setMarkets(null);
      return;
    }
    loadMarkets(selectedId);
  }, [selectedId, loadMarkets]);

  if (matches.length === 0) return null;

  const categories = markets
    ? Object.entries(markets.by_category).sort(([a], [b]) => a.localeCompare(b, "es"))
    : [];

  const kickoff =
    selectedMatch &&
    formatKickoffTimeEs(selectedMatch.date ?? markets?.date ?? "", selectedMatch.kickoff_at);

  return (
    <section className="card match-market-picker">
      <header className="match-market-picker-head">
        <div>
          <h3 className="section-title">Partidos del día</h3>
          <p className="muted small">
            {dayLabel} — elige un partido y añade mercados al cupón
          </p>
        </div>
      </header>

      <div className="match-picker-grid">
        {matches.map((m) => {
          const time = formatKickoffTimeEs(m.date ?? "", m.kickoff_at);
          return (
            <button
              key={m.match_id}
              type="button"
              className={`match-picker-btn ${selectedId === m.match_id ? "active" : ""}`}
              onClick={() => setSelectedId(m.match_id)}
            >
              <span className="match-picker-teams">
                {m.home_team} <span className="muted">vs</span> {m.away_team}
              </span>
              <span className="match-picker-meta muted small">
                {time && <span>{time}</span>}
                {m.selections_count > 0 && (
                  <span>{m.selections_count} mercados</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selectedMatch && (
        <div className="match-market-panel">
          <div className="match-market-panel-head">
            <div>
              <strong>
                {selectedMatch.home_team} vs {selectedMatch.away_team}
              </strong>
              {kickoff && <span className="muted small"> · {kickoff}</span>}
              {selectedMatch.round && (
                <span className="muted small">
                  {" "}
                  · {selectedMatch.round.replaceAll("|", " · ")}
                </span>
              )}
            </div>
            <Link to={`/partido/${selectedMatch.match_id}`} className="match-card-cta">
              Ver ficha →
            </Link>
          </div>

          {loadingMarkets && (
            <p className="muted small loading-dots">Cargando mercados</p>
          )}
          {marketError != null ? <ErrorAlert error={marketError} /> : null}
          {!loadingMarkets && markets && (
            <div className="market-categories">
              {markets.recommended.length > 0 && (
                <div className="market-category">
                  <h4 className="market-category-title">Recomendados</h4>
                  <div className="market-selections">
                    {markets.recommended.map((sel) => (
                      <MarketButton
                        key={sel.selection_id}
                        sel={sel}
                        inSlip={slipIds.has(sel.selection_id)}
                        onAdd={() => onAdd(selectedMatch, sel)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {categories.map(([cat, sels]) => (
                <div key={cat} className="market-category">
                  <h4 className="market-category-title">{cat}</h4>
                  <div className="market-selections">
                    {sels.map((sel) => (
                      <MarketButton
                        key={sel.selection_id}
                        sel={sel}
                        inSlip={slipIds.has(sel.selection_id)}
                        onAdd={() => onAdd(selectedMatch, sel)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {categories.length === 0 && markets.recommended.length === 0 && (
                <p className="muted small">
                  Sin mercados para este partido. Sincroniza cuotas en Configuración.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
