import { useCallback, useState } from "react";
import {
  evaluateBettingSlip,
  type SlipEvaluation,
} from "../../api/client";
import { useBetSlip } from "../../context/BetSlipContext";
import { placeBet } from "../../lib/bettingWallet";

export function BetSlipPanel({
  balance,
  onBalanceChange,
}: {
  balance: number;
  onBalanceChange: () => void;
}) {
  const {
    legs,
    stake,
    mode,
    evaluation,
    evaluating,
    setStake,
    setMode,
    removeLeg,
    clearSlip,
    setEvaluation,
    setEvaluating,
    combinedOdds,
    combinedProbabilityPct,
    legCount,
  } = useBetSlip();

  const [placeMsg, setPlaceMsg] = useState<string | null>(null);

  const runEvaluate = useCallback(async () => {
    if (legs.length === 0) return;
    setEvaluating(true);
    setPlaceMsg(null);
    try {
      const apiMode =
        mode === "singles" && legs.length > 1
          ? "singles"
          : legs.length === 1
            ? "single"
            : "accumulator";
      const res = await evaluateBettingSlip({
        stake,
        mode: apiMode,
        legs: legs.map((l) => ({
          match_id: l.match_id,
          selection_id: l.selection_id,
          market: l.market,
          selection: l.selection,
          category: l.category,
          model_probability: l.model_probability,
          decimal_odds: l.decimal_odds,
          scope: l.scope,
        })),
      });
      setEvaluation(res);
    } catch (e) {
      setEvaluation({
        status: "error",
        message: e instanceof Error ? e.message : "Error",
        legs: [],
      });
    } finally {
      setEvaluating(false);
    }
  }, [legs, stake, mode, setEvaluation, setEvaluating]);

  const handlePlace = () => {
    if (!evaluation || evaluation.status !== "ok") {
      setPlaceMsg("Primero analiza el cupon con el modelo.");
      return;
    }
    if (stake > balance) {
      setPlaceMsg("Saldo ficticio insuficiente.");
      return;
    }
    const ok = placeBet({
      stake,
      mode: evaluation.mode ?? mode,
      potentialWin: evaluation.potential_win ?? 0,
      combinedOdds: evaluation.combined_odds ?? combinedOdds,
      legsCount: evaluation.legs_count ?? legs.length,
    });
    if (!ok) {
      setPlaceMsg("No se pudo registrar la apuesta.");
      return;
    }
    onBalanceChange();
    clearSlip();
    setPlaceMsg("Apuesta ficticia registrada. Saldo actualizado.");
  };

  return (
    <aside className="bet-slip-panel card">
      <header className="bet-slip-head">
        <h2>Cupon</h2>
        <span className="bet-slip-count">{legCount}</span>
      </header>

      {legs.length === 0 ? (
        <p className="muted small bet-slip-empty">
          Pulsa cualquier cuota o genera la apuesta del dia.
        </p>
      ) : (
        <ul className="bet-slip-legs">
          {legs.map((leg) => (
            <li key={leg.selection_id} className="bet-slip-leg">
              <button
                type="button"
                className="bet-slip-remove"
                onClick={() => removeLeg(leg.selection_id)}
                aria-label="Quitar"
              >
                ×
              </button>
              <div className="bet-slip-leg-body">
                <span className="bet-slip-match">{leg.match_label}</span>
                <span className="bet-slip-market">{leg.market}</span>
                <strong>{leg.selection}</strong>
                <span className="bet-slip-odds">@{leg.decimal_odds.toFixed(2)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="bet-slip-mode">
        <button
          type="button"
          className={mode === "accumulator" ? "active" : ""}
          onClick={() => setMode("accumulator")}
        >
          Combinada
        </button>
        <button
          type="button"
          className={mode === "singles" ? "active" : ""}
          onClick={() => setMode("singles")}
          disabled={legCount < 2}
        >
          Simples
        </button>
      </div>

      <label className="bet-slip-stake">
        <span>Importe (EUR fict.)</span>
        <input
          type="number"
          min={0.5}
          max={balance}
          step={0.5}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value) || 0)}
        />
      </label>

      {legCount > 0 && (
        <p className="bet-slip-hint muted small">
          Combinada ({legCount} piernas): cuota{" "}
          <strong>{combinedOdds.toFixed(2)}</strong>
          {legCount > 1 && (
            <>
              {" "}
              · prob. modelo <strong>{combinedProbabilityPct}%</strong>
            </>
          )}
        </p>
      )}

      <button
        type="button"
        className="btn primary bet-slip-analyze"
        disabled={legCount === 0 || evaluating}
        onClick={runEvaluate}
      >
        {evaluating ? "Analizando…" : "Analizar con el modelo"}
      </button>

      {evaluation && <EvaluationBlock evaluation={evaluation} />}

      <button
        type="button"
        className="btn bet-slip-place"
        disabled={!evaluation || evaluation.status !== "ok"}
        onClick={handlePlace}
      >
        Apostar (ficticio)
      </button>

      {placeMsg && <p className="bet-slip-msg small">{placeMsg}</p>}

      {legCount > 0 && (
        <button type="button" className="btn ghost small" onClick={clearSlip}>
          Vaciar cupon
        </button>
      )}
    </aside>
  );
}

function EvaluationBlock({ evaluation }: { evaluation: SlipEvaluation }) {
  if (evaluation.status === "error") {
    return <div className="bet-eval error">{evaluation.message}</div>;
  }
  return (
    <div className="bet-eval ok">
      <p className="bet-eval-verdict">{evaluation.verdict}</p>
      <div className="bet-eval-grid">
        {evaluation.combined_probability_pct != null && (
          <div>
            <span>Prob. conjunta</span>
            <strong>{evaluation.combined_probability_pct}%</strong>
          </div>
        )}
        {evaluation.combined_odds != null && (
          <div>
            <span>Cuota total</span>
            <strong>{evaluation.combined_odds.toFixed(2)}</strong>
          </div>
        )}
        <div>
          <span>Ganarias</span>
          <strong className="win">
            +{(evaluation.potential_profit ?? 0).toFixed(2)} €
          </strong>
        </div>
        <div>
          <span>Perderias</span>
          <strong className="loss">
            -{(evaluation.potential_loss ?? 0).toFixed(2)} €
          </strong>
        </div>
        {evaluation.expected_value != null && (
          <div className="bet-eval-ev">
            <span>Valor esperado (modelo)</span>
            <strong>
              {evaluation.expected_value >= 0 ? "+" : ""}
              {evaluation.expected_value.toFixed(2)} €
            </strong>
          </div>
        )}
      </div>
      <ul className="bet-eval-legs muted small">
        {evaluation.legs.map((l, i) =>
          l.status === "ok" ? (
            <li key={i}>
              {l.match_label}: {l.probability_pct}% · @{l.decimal_odds?.toFixed(2)}
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}
