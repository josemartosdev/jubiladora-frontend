import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getAppClock as fetchAppClock, type AppClock } from "../api/client";
import {
  formatLiveTimeEs,
  getAppClock,
  setAppClock,
} from "../lib/appClockStore";

type AppClockContextValue = {
  clock: AppClock | null;
  todayIso: string;
  refresh: () => Promise<void>;
  syncClock: (clock: AppClock) => void;
  displayLabel: string;
  liveTime: string;
};

const AppClockContext = createContext<AppClockContextValue | null>(null);

export function AppClockProvider({ children }: { children: ReactNode }) {
  const [clock, setClockState] = useState<AppClock | null>(getAppClock());
  const [liveTime, setLiveTime] = useState(() => formatLiveTimeEs(new Date()));

  const applyClock = useCallback((c: AppClock) => {
    setAppClock(c);
    setClockState(c);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetchAppClock();
    applyClock(res);
  }, [applyClock]);

  useEffect(() => {
    refresh().catch(() => {});
    const id = setInterval(() => refresh().catch(() => {}), 5 * 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      setLiveTime(formatLiveTimeEs(new Date()));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const displayLabel = useMemo(() => {
    if (!clock) return "Cargando fecha…";
    if (clock.is_fixed) {
      return `${clock.date_label_es} · ${clock.time_label_es} (fija)`;
    }
    return `${clock.date_label_es} · ${liveTime} (España)`;
  }, [clock, liveTime]);

  const value = useMemo(
    () => ({
      clock,
      todayIso: clock?.today_iso ?? new Date().toISOString().slice(0, 10),
      refresh,
      syncClock: applyClock,
      displayLabel,
      liveTime,
    }),
    [clock, refresh, applyClock, displayLabel, liveTime],
  );

  return (
    <AppClockContext.Provider value={value}>{children}</AppClockContext.Provider>
  );
}

export function useAppClock(): AppClockContextValue {
  const ctx = useContext(AppClockContext);
  if (!ctx) {
    throw new Error("useAppClock debe usarse dentro de AppClockProvider");
  }
  return ctx;
}
