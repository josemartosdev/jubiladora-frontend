/** Reloj de referencia de la app (sincronizado con el backend). */

import type { AppClock } from "../api/client";

let _clock: AppClock | null = null;

export function setAppClock(clock: AppClock | null): void {
  _clock = clock;
}

export function getAppClock(): AppClock | null {
  return _clock;
}

export function getAppTodayIso(): string {
  return _clock?.today_iso ?? new Date().toISOString().slice(0, 10);
}

export function isAppToday(isoDate: string): boolean {
  return isoDate === getAppTodayIso();
}

export function formatLiveTimeEs(now: Date): string {
  return now.toLocaleTimeString("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
