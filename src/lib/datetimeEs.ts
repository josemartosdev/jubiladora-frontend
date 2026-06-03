const TZ_ES = "Europe/Madrid";
const LOCALE_ES = "es-ES";

/** Parsea ISO UTC o fecha YYYY-MM-DD. */
export function parseMatchInstant(iso: string): Date | null {
  if (!iso?.trim()) return null;
  const s = iso.trim();
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return new Date(`${s}T12:00:00Z`);
    }
    const normalized = s.includes("T") ? s.replace("Z", "+00:00") : s;
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function hasClockTime(iso: string, kickoffAt?: string | null): boolean {
  const raw = kickoffAt?.trim() || iso?.trim() || "";
  return raw.includes("T") && !/T12:00:00/.test(raw);
}

export function formatKickoffTimeEs(
  iso: string,
  kickoffAt?: string | null,
): string | null {
  const raw = kickoffAt?.trim() || iso?.trim() || "";
  if (!hasClockTime(iso, kickoffAt)) return null;
  const d = parseMatchInstant(raw);
  if (!d) return null;
  return d.toLocaleTimeString(LOCALE_ES, {
    timeZone: TZ_ES,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatMatchDateEs(iso: string, kickoffAt?: string | null): string {
  const raw = kickoffAt?.trim() || iso?.trim() || "";
  const d = parseMatchInstant(raw);
  if (!d) return iso || "—";
  return d.toLocaleDateString(LOCALE_ES, {
    timeZone: TZ_ES,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatMatchDateShortEs(
  iso: string,
  kickoffAt?: string | null,
): string {
  const raw = kickoffAt?.trim() || iso?.trim() || "";
  const d = parseMatchInstant(raw);
  if (!d) return iso || "—";
  return d.toLocaleDateString(LOCALE_ES, {
    timeZone: TZ_ES,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Ej: «viernes, 13 de junio de 2026 · 21:00 (hora España)» */
export function formatMatchScheduleEs(
  iso: string,
  kickoffAt?: string | null,
): string {
  const datePart = formatMatchDateEs(iso, kickoffAt);
  const timePart = formatKickoffTimeEs(iso, kickoffAt);
  if (timePart) {
    return `${datePart} · ${timePart} (hora España)`;
  }
  return datePart;
}
