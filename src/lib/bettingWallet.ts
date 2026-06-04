const WALLET_KEY = "jubiladora_virtual_wallet";
const HISTORY_KEY = "jubiladora_bet_history";
const START_BALANCE = 1000;

export type PlacedBet = {
  id: string;
  placedAt: string;
  stake: number;
  mode: string;
  potentialWin: number;
  combinedOdds: number;
  legsCount: number;
  status: "pending" | "won" | "lost";
};

export function loadBalance(): number {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (raw == null) return START_BALANCE;
    const n = Number(raw);
    return Number.isFinite(n) ? n : START_BALANCE;
  } catch {
    return START_BALANCE;
  }
}

export function saveBalance(amount: number) {
  localStorage.setItem(WALLET_KEY, String(Math.max(0, amount)));
}

export function resetWallet() {
  saveBalance(START_BALANCE);
  localStorage.removeItem(HISTORY_KEY);
}

export function loadHistory(): PlacedBet[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PlacedBet[];
  } catch {
    return [];
  }
}

export function placeBet(record: Omit<PlacedBet, "id" | "placedAt" | "status">) {
  const balance = loadBalance();
  if (record.stake > balance) return false;
  saveBalance(balance - record.stake);
  const history = loadHistory();
  history.unshift({
    ...record,
    id: crypto.randomUUID(),
    placedAt: new Date().toISOString(),
    status: "pending",
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  return true;
}
