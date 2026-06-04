import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BettingSelection, SlipEvaluation } from "../api/client";

export type SlipLeg = {
  match_id: number;
  match_label: string;
  selection_id: string;
  category: string;
  market: string;
  selection: string;
  decimal_odds: number;
  model_probability: number;
  scope?: string;
};

type BetSlipContextValue = {
  legs: SlipLeg[];
  stake: number;
  mode: "accumulator" | "singles";
  evaluation: SlipEvaluation | null;
  evaluating: boolean;
  setStake: (n: number) => void;
  setMode: (m: "accumulator" | "singles") => void;
  addLeg: (match: {
    match_id: number;
    home_team: string;
    away_team: string;
  }, sel: BettingSelection) => void;
  /** Sustituye el cupon por varias piernas (p. ej. combinada generada). */
  replaceLegs: (
    items: Array<{
      match: { match_id: number; home_team: string; away_team: string };
      sel: BettingSelection;
    }>,
  ) => void;
  removeLeg: (selectionId: string) => void;
  clearSlip: () => void;
  setEvaluation: (e: SlipEvaluation | null) => void;
  setEvaluating: (v: boolean) => void;
  legCount: number;
  combinedOdds: number;
  combinedProbabilityPct: number;
};

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

function toSlipLeg(
  match: { match_id: number; home_team: string; away_team: string },
  sel: BettingSelection,
): SlipLeg {
  const label =
    match.match_id > 0
      ? `${match.home_team} vs ${match.away_team}`
      : sel.market;
  return {
    match_id: match.match_id,
    match_label: label,
    selection_id: sel.selection_id,
    category: sel.category,
    market: sel.market,
    selection: sel.selection,
    decimal_odds: sel.decimal_odds,
    model_probability: sel.model_probability,
    scope: (sel as BettingSelection & { scope?: string }).scope,
  };
}

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [legs, setLegs] = useState<SlipLeg[]>([]);
  const [stake, setStake] = useState(10);
  const [mode, setMode] = useState<"accumulator" | "singles">("accumulator");
  const [evaluation, setEvaluation] = useState<SlipEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const addLeg = useCallback(
    (
      match: { match_id: number; home_team: string; away_team: string },
      sel: BettingSelection,
    ) => {
      setEvaluation(null);
      setLegs((prev) => {
        const withoutDup = prev.filter((l) => l.selection_id !== sel.selection_id);
        // Mismo partido: solo sustituir la misma linea de mercado (combinada multi-pierna).
        const base =
          match.match_id > 0
            ? withoutDup.filter(
                (l) => l.match_id !== match.match_id || l.market !== sel.market,
              )
            : withoutDup;
        return [...base, toSlipLeg(match, sel)];
      });
    },
    [],
  );

  const replaceLegs = useCallback(
    (
      items: Array<{
        match: { match_id: number; home_team: string; away_team: string };
        sel: BettingSelection;
      }>,
    ) => {
      setEvaluation(null);
      setLegs(items.map(({ match, sel }) => toSlipLeg(match, sel)));
      setMode("accumulator");
    },
    [],
  );

  const removeLeg = useCallback((selectionId: string) => {
    setEvaluation(null);
    setLegs((prev) => prev.filter((l) => l.selection_id !== selectionId));
  }, []);

  const clearSlip = useCallback(() => {
    setLegs([]);
    setEvaluation(null);
  }, []);

  const combinedOdds = useMemo(
    () => legs.reduce((acc, l) => acc * l.decimal_odds, 1),
    [legs],
  );

  const combinedProbabilityPct = useMemo(() => {
    if (!legs.length) return 0;
    const p = legs.reduce((acc, l) => acc * l.model_probability, 1);
    return Math.round(p * 1000) / 10;
  }, [legs]);

  const value = useMemo(
    () => ({
      legs,
      stake,
      mode,
      evaluation,
      evaluating,
      setStake,
      setMode,
      addLeg,
      replaceLegs,
      removeLeg,
      clearSlip,
      setEvaluation,
      setEvaluating,
      legCount: legs.length,
      combinedOdds: legs.length ? Math.round(combinedOdds * 100) / 100 : 0,
      combinedProbabilityPct,
    }),
    [
      legs,
      stake,
      mode,
      evaluation,
      evaluating,
      addLeg,
      replaceLegs,
      removeLeg,
      clearSlip,
      combinedOdds,
      combinedProbabilityPct,
    ],
  );

  return (
    <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip debe usarse dentro de BetSlipProvider");
  return ctx;
}
