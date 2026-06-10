import type {
  BettingOutrightsResponse,
  BettingSelection,
  CalendarDay,
  WorldCupCalendar,
} from "../api/client";
import { isWorldCupFixture } from "./worldCup";

export const WC_TOTAL_TEAMS = 48;
export const WC_QUALIFIERS = 32;

export type SimTeam = {
  id: string;
  name: string;
  strength: number;
  groupProb: number;
  r16Prob: number;
  sfProb: number;
  winnerProb: number;
};

export type SimMatch = {
  code: string;
  home: string;
  away: string;
  winner: string;
  loser: string;
  score: string;
  homeWinProb: number;
};

export type SimPhase = {
  id: string;
  label: string;
  shortLabel: string;
  qualifiers?: string[];
  matches?: SimMatch[];
};

export type BracketColumn = {
  id: string;
  label: string;
  shortLabel: string;
  matches: SimMatch[];
};

export type PlayerAchievement = {
  id: string;
  title: string;
  subtitle: string;
  player: string;
  team: string;
  icon: string;
  probability: number;
  stat: string;
  tier: "gold" | "silver" | "bronze" | "special";
};

export type SimPick = {
  phase: string;
  market: string;
  selection: string;
  probability: number;
  hit: boolean;
};

export type TournamentSimulation = {
  seed: number;
  champion: string;
  runnerUp: string;
  phases: SimPhase[];
  bracket: BracketColumn[];
  groupAllTeams: string[];
  groupQualifiers: string[];
  groupEliminated: string[];
  playerAchievements: PlayerAchievement[];
  picks: SimPick[];
  teamsFromCalendar: number;
  teamsFromOutrights: number;
};

const ROUND_META: {
  id: string;
  label: string;
  shortLabel: string;
  matches: number;
}[] = [
  { id: "GROUPS", label: "Fase de grupos", shortLabel: "Grupos", matches: 0 },
  { id: "LAST_32", label: "Dieciseisavos", shortLabel: "1/16", matches: 16 },
  { id: "LAST_16", label: "Octavos", shortLabel: "1/8", matches: 8 },
  { id: "QUARTER_FINALS", label: "Cuartos", shortLabel: "1/4", matches: 4 },
  { id: "SEMI_FINALS", label: "Semifinales", shortLabel: "1/2", matches: 2 },
  { id: "FINAL", label: "Final", shortLabel: "F", matches: 1 },
];

function teamNameFromSelection(sel: BettingSelection): string {
  const s = sel.selection;
  if (s.includes(" — ")) {
    return s.split(" — ").pop()!.trim();
  }
  return s.trim();
}

function parsePlayerSelection(sel: BettingSelection): { player: string; team: string } | null {
  const s = sel.selection;
  if (!s.includes(" — ")) return null;
  const [player, team] = s.split(" — ").map((x) => x.trim());
  if (!player || !team) return null;
  return { player, team };
}

function teamIdFromSelectionId(selectionId: string): string | null {
  const m = selectionId.match(/-(\d+)$/);
  return m ? m[1] : null;
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isGroupRound(round: string | null | undefined): boolean {
  if (!round) return false;
  const u = round.toUpperCase();
  return u.includes("GROUP_STAGE") || /GROUP_[A-L]/.test(u);
}

/** Selecciones de fase de grupos desde el calendario WC (puede estar incompleto en BD). */
export function extractWorldCupGroupTeams(wc: WorldCupCalendar): string[] {
  const teams = new Set<string>();
  for (const day of wc.by_date ?? []) {
    for (const m of [...day.upcoming, ...day.finished]) {
      if (isGroupRound(m.round)) {
        teams.add(m.home_team);
        teams.add(m.away_team);
      }
    }
  }
  for (const phase of wc.phases ?? []) {
    if (phase.id !== "GROUP_STAGE") continue;
    for (const g of phase.groups ?? []) {
      for (const m of g.matches ?? []) {
        teams.add(m.home_team);
        teams.add(m.away_team);
      }
    }
    for (const m of phase.matches ?? []) {
      if (isGroupRound(m.round)) {
        teams.add(m.home_team);
        teams.add(m.away_team);
      }
    }
  }
  return [...teams].sort((a, b) => a.localeCompare(b, "es"));
}

/** Selecciones desde /fixtures/calendar (suele tener las 48 del Mundial 2026). */
export function extractWorldCupTeamsFromCalendar(cal: {
  days: CalendarDay[];
}): string[] {
  const teams = new Set<string>();
  for (const day of cal.days ?? []) {
    for (const m of [...day.upcoming, ...day.finished]) {
      if (isWorldCupFixture(m)) {
        teams.add(m.home_team);
        teams.add(m.away_team);
      }
    }
  }
  return [...teams].sort((a, b) => a.localeCompare(b, "es"));
}

/** Une calendario WC, calendario general y outrights (sin duplicados). */
export function collectWorldCupTeamNames(
  wc: WorldCupCalendar | null,
  cal: { days: CalendarDay[] } | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (name: string) => {
    const key = normalizeTeamName(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };
  if (wc) {
    for (const n of extractWorldCupGroupTeams(wc)) add(n);
    for (const day of wc.by_date ?? []) {
      for (const m of [...day.upcoming, ...day.finished]) {
        if (isWorldCupFixture(m)) {
          add(m.home_team);
          add(m.away_team);
        }
      }
    }
  }
  if (cal) {
    for (const n of extractWorldCupTeamsFromCalendar(cal)) add(n);
  }
  return out;
}

function findTeamByName(
  map: Map<string, SimTeam>,
  name: string,
): SimTeam | undefined {
  const key = normalizeTeamName(name);
  for (const t of map.values()) {
    if (normalizeTeamName(t.name) === key) return t;
  }
  return undefined;
}

/** 48 selecciones oficiales (Elo WC2026). El calendario solo aporta nombres ya en outrights. */
export function buildWorldCupTeamPool(
  outrights: BettingOutrightsResponse,
  wcTeamNames: string[],
): { names: string[]; fromCalendar: number; fromOutrights: number } {
  const fromOutrights = parseTeams(outrights);
  const seen = new Set<string>();
  const pool: string[] = [];

  const add = (name: string) => {
    const key = normalizeTeamName(name);
    if (!key || seen.has(key)) return;
    if (!findTeamByName(fromOutrights, name)) return;
    seen.add(key);
    pool.push(name);
  };

  let fromCalendar = 0;
  for (const name of wcTeamNames) {
    const before = pool.length;
    add(name);
    if (pool.length > before) fromCalendar += 1;
  }

  const eloSorted = [...fromOutrights.values()].sort(
    (a, b) => b.strength - a.strength || a.name.localeCompare(b.name, "es"),
  );
  for (const t of eloSorted) {
    if (pool.length >= WC_TOTAL_TEAMS) break;
    const key = normalizeTeamName(t.name);
    if (!seen.has(key)) {
      seen.add(key);
      pool.push(t.name);
    }
  }

  return {
    names: pool.slice(0, WC_TOTAL_TEAMS),
    fromCalendar,
    fromOutrights: pool.length - fromCalendar,
  };
}

/** Fusiona pool de 48 equipos con probabilidades Elo de outrights. */
export function buildWorldCupTeams(
  outrights: BettingOutrightsResponse,
  wcTeamNames: string[],
): SimTeam[] {
  const fromOutrights = parseTeams(outrights);
  const { names: pool } = buildWorldCupTeamPool(outrights, wcTeamNames);

  let autoId = 9000;
  return pool.map((name) => {
    const matched = findTeamByName(fromOutrights, name);
    if (matched) {
      return { ...matched, name };
    }
    return {
      id: String(autoId++),
      name,
      strength: 0.025,
      groupProb: 0.42,
      r16Prob: 0.18,
      sfProb: 0.07,
      winnerProb: 0.012,
    };
  });
}

function parseTeams(outrights: BettingOutrightsResponse): Map<string, SimTeam> {
  const map = new Map<string, SimTeam>();

  for (const sel of outrights.selections) {
    const id = teamIdFromSelectionId(sel.selection_id);
    if (!id) continue;
    const name = teamNameFromSelection(sel);
    if (!name || name === "Si" || name === "No") continue;

    let team = map.get(id);
    if (!team) {
      team = {
        id,
        name,
        strength: 0.01,
        groupProb: 0.5,
        r16Prob: 0.25,
        sfProb: 0.1,
        winnerProb: 0.02,
      };
      map.set(id, team);
    }

    const cat = sel.category.toLowerCase();
    const market = sel.market.toLowerCase();
    if (cat.includes("grupos") && market.includes("pasa")) {
      team.groupProb = sel.model_probability;
    } else if (market.includes("octavos")) {
      team.r16Prob = sel.model_probability;
    } else if (market.includes("semifinal")) {
      team.sfProb = sel.model_probability;
    } else if (market.includes("ganador del mundial")) {
      team.winnerProb = sel.model_probability;
      team.strength = Math.max(team.strength, sel.model_probability);
    }
  }

  for (const team of map.values()) {
    team.strength = Math.max(
      team.strength,
      team.winnerProb * 2 + team.sfProb * 0.5 + team.r16Prob * 0.15,
      0.01,
    );
  }

  return map;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function simulateMatch(
  home: SimTeam,
  away: SimTeam,
  code: string,
  rand: () => number,
): SimMatch {
  const homeWinProb = home.strength / (home.strength + away.strength);
  const homeWins = rand() < homeWinProb;
  const winner = homeWins ? home : away;
  const loser = homeWins ? away : home;
  const wGoals = 1 + (rand() < 0.45 ? 1 : 0) + (rand() < 0.12 ? 1 : 0);
  const lGoals = rand() < 0.32 ? 1 : 0;
  const score = homeWins ? `${wGoals}-${lGoals}` : `${lGoals}-${wGoals}`;

  return {
    code,
    home: home.name,
    away: away.name,
    winner: winner.name,
    loser: loser.name,
    score,
    homeWinProb: Math.round(homeWinProb * 1000) / 10,
  };
}

function pickQualifiers(teams: SimTeam[], count: number, rand: () => number): SimTeam[] {
  const scored = teams.map((t) => ({
    team: t,
    roll: t.groupProb * (0.85 + rand() * 0.3),
  }));
  scored.sort((a, b) => b.roll - a.roll);
  return scored.slice(0, count).map((s) => s.team);
}

function pairBracket(teams: SimTeam[]): [SimTeam, SimTeam][] {
  const sorted = [...teams].sort((a, b) => b.strength - a.strength);
  const pairs: [SimTeam, SimTeam][] = [];
  for (let i = 0; i < sorted.length / 2; i++) {
    pairs.push([sorted[i], sorted[sorted.length - 1 - i]]);
  }
  return pairs;
}

function weightedPick<T extends { weight: number }>(items: T[], rand: () => number): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rand() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function buildPlayerAchievements(
  outrights: BettingOutrightsResponse,
  champion: string,
  runnerUp: string,
  finalistTeams: Set<string>,
  rand: () => number,
): PlayerAchievement[] {
  const achievements: PlayerAchievement[] = [];

  const scorers = outrights.selections
    .filter((s) => s.category.includes("Goleador"))
    .map((s) => {
      const parsed = parsePlayerSelection(s);
      return {
        player: parsed?.player ?? s.selection,
        team: parsed?.team ?? teamNameFromSelection(s),
        weight: s.model_probability,
        prob: s.model_probability,
      };
    })
    .filter((s) => s.team && s.team !== "Si");

  const bootWinner = weightedPick(
    scorers.length > 0 ? scorers : [{ player: "Delantero estrella", team: champion, weight: 1, prob: 0.14 }],
    rand,
  );
  const bootGoals = 4 + Math.floor(rand() * 4);

  achievements.push({
    id: "golden-boot",
    title: "Bota de oro",
    subtitle: "Máximo goleador del torneo",
    player: bootWinner.player,
    team: bootWinner.team,
    icon: "⚽",
    probability: Math.round(bootWinner.prob * 1000) / 10,
    stat: `${bootGoals} goles proyectados`,
    tier: "gold",
  });

  const mvpTeam = finalistTeams.has(bootWinner.team) ? bootWinner.team : champion;
  achievements.push({
    id: "ballon",
    title: "Balón de oro",
    subtitle: "Mejor jugador del Mundial",
    player: `Crack de ${mvpTeam}`,
    team: mvpTeam,
    icon: "🏆",
    probability: Math.round((bootWinner.prob + 0.08) * 1000) / 10,
    stat: "MVP del torneo simulado",
    tier: "gold",
  });

  achievements.push({
    id: "golden-glove",
    title: "Guante de oro",
    subtitle: "Mejor portero",
    player: `Portero de ${champion}`,
    team: champion,
    icon: "🧤",
    probability: Math.round(12 + rand() * 8),
    stat: `${(2.8 + rand() * 0.9).toFixed(1)} goles encajados de media`,
    tier: "silver",
  });

  const assistCandidates = scorers
    .filter((s) => s.team !== bootWinner.team)
    .slice(0, 5);
  const assistPick = assistCandidates[Math.floor(rand() * Math.max(1, assistCandidates.length))] ?? bootWinner;

  achievements.push({
    id: "playmaker",
    title: "Máximo asistente",
    subtitle: "Rey del pase de gol",
    player: `Mediapunta — ${assistPick.team}`,
    team: assistPick.team,
    icon: "🎯",
    probability: Math.round(assistPick.prob * 900) / 10,
    stat: `${3 + Math.floor(rand() * 4)} asistencias`,
    tier: "silver",
  });

  const darkHorse = outrights.selections.find((s) => s.selection_id.includes("dark-horse"));
  const youthTeam = darkHorse ? teamNameFromSelection(darkHorse) : runnerUp;

  achievements.push({
    id: "young-player",
    title: "Mejor joven",
    subtitle: "Revelación sub-23",
    player: `Joven promesa — ${youthTeam}`,
    team: youthTeam,
    icon: "⭐",
    probability: Math.round((darkHorse?.model_probability ?? 0.1) * 1000) / 10,
    stat: "Impacto en fase de grupos",
    tier: "bronze",
  });

  achievements.push({
    id: "fair-play",
    title: "Juego limpio",
    subtitle: "Menos tarjetas del torneo",
    player: `Capitán — ${runnerUp}`,
    team: runnerUp,
    icon: "🟢",
    probability: Math.round(8 + rand() * 6),
    stat: "0 rojas · 2 amarillas",
    tier: "special",
  });

  return achievements;
}

function buildPicks(phases: SimPhase[], outrights: BettingOutrightsResponse): SimPick[] {
  const advanced = new Set<string>();
  for (const phase of phases) {
    phase.qualifiers?.forEach((q) => advanced.add(q));
    phase.matches?.forEach((m) => advanced.add(m.winner));
  }

  const picks: SimPick[] = [];
  for (const sel of outrights.selections) {
    if (!sel.recommended) continue;
    const team = teamNameFromSelection(sel);
    if (!advanced.has(team) && !sel.market.includes("torneo con media")) continue;

    let phase = "Torneo";
    if (sel.market.includes("grupos")) phase = "Grupos";
    else if (sel.market.includes("octavos")) phase = "Dieciseisavos";
    else if (sel.market.includes("semifinal")) phase = "Semifinales";
    else if (sel.market.includes("Ganador")) phase = "Campeón";

    picks.push({
      phase,
      market: sel.market,
      selection: sel.selection,
      probability: Math.round(sel.model_probability * 1000) / 10,
      hit: advanced.has(team) || sel.selection === "Si",
    });
  }

  return picks.slice(0, 12);
}

export function runTournamentSimulation(
  outrights: BettingOutrightsResponse,
  seed = Date.now(),
  wcTeamNames: string[] = [],
): TournamentSimulation {
  const rand = mulberry32(seed);
  const poolMeta = buildWorldCupTeamPool(outrights, wcTeamNames);
  const allTeams = buildWorldCupTeams(outrights, wcTeamNames);

  if (allTeams.length < WC_QUALIFIERS) {
    throw new Error(
      `Se necesitan al menos ${WC_QUALIFIERS} selecciones (hay ${allTeams.length}). ` +
        `Sincroniza el calendario del Mundial o ejecuta el pipeline en Configuración.`,
    );
  }

  const phases: SimPhase[] = [];
  const bracket: BracketColumn[] = [];

  const qualified = pickQualifiers(allTeams, WC_QUALIFIERS, rand);
  const groupNames = qualified.map((t) => t.name);
  const allNames = allTeams.map((t) => t.name);
  const eliminated = allNames.filter((n) => !groupNames.includes(n));

  phases.push({
    id: "GROUPS",
    label: ROUND_META[0].label,
    shortLabel: ROUND_META[0].shortLabel,
    qualifiers: groupNames,
  });

  let remaining = [...qualified];
  const knockoutRounds = ROUND_META.slice(1);
  const semifinalists = new Set<string>();

  for (const round of knockoutRounds) {
    const pairs = pairBracket(remaining);
    const matches: SimMatch[] = [];
    const winners: SimTeam[] = [];

    pairs.slice(0, round.matches).forEach(([home, away], i) => {
      const m = simulateMatch(home, away, `${round.id}-${i + 1}`, rand);
      matches.push(m);
      const w = remaining.find((t) => t.name === m.winner);
      if (w) winners.push(w);
    });

    if (round.id === "SEMI_FINALS") {
      winners.forEach((w) => semifinalists.add(w.name));
    }

    phases.push({
      id: round.id,
      label: round.label,
      shortLabel: round.shortLabel,
      matches,
      qualifiers: winners.map((t) => t.name),
    });

    bracket.push({
      id: round.id,
      label: round.label,
      shortLabel: round.shortLabel,
      matches,
    });

    remaining = winners;
  }

  const finalPhase = phases.find((p) => p.id === "FINAL");
  const finalMatch = finalPhase?.matches?.[0];
  const champion = finalMatch?.winner ?? remaining[0]?.name ?? "—";
  const runnerUp = finalMatch?.loser ?? "—";

  const finalistTeams = new Set([champion, runnerUp, ...semifinalists]);

  return {
    seed,
    champion,
    runnerUp,
    phases,
    bracket,
    groupAllTeams: allNames,
    groupQualifiers: groupNames,
    groupEliminated: eliminated,
    playerAchievements: buildPlayerAchievements(
      outrights,
      champion,
      runnerUp,
      finalistTeams,
      rand,
    ),
    picks: buildPicks(phases, outrights),
    teamsFromCalendar: poolMeta.fromCalendar,
    teamsFromOutrights: poolMeta.fromOutrights,
  };
}
