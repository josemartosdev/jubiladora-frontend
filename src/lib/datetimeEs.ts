const TZ_ES = "Europe/Madrid";
const LOCALE_ES = "es-ES";

/** Normaliza ISO de Postgres/API (espacio, Z, offset). */
export function normalizeInstantString(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  if (/^\d{4}-\d{2}-\d{2} \d/.test(s)) {
    s = s.replace(" ", "T");
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    s = `${s}Z`;
  }
  return s.replace("Z", "+00:00");
}

/** Parsea ISO UTC o fecha YYYY-MM-DD. */
export function parseMatchInstant(iso: string): Date | null {
  if (!iso?.trim()) return null;
  const s = iso.trim();
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return new Date(`${s}T12:00:00Z`);
    }
    const d = new Date(normalizeInstantString(s));
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function hasClockTime(iso: string, kickoffAt?: string | null): boolean {
  const raw = kickoffAt?.trim() || iso?.trim() || "";
  if (!raw) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  return /[T ]\d{1,2}:\d{2}/.test(raw) && !/T12:00:00/.test(raw);
}

/** Hora del partido en península (Europe/Madrid). Ej: «18:45». */
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

/** Ej: «viernes, 13 de junio de 2026 · 21:00» */
export function formatMatchScheduleEs(
  iso: string,
  kickoffAt?: string | null,
): string {
  const datePart = formatMatchDateEs(iso, kickoffAt);
  const timePart = formatKickoffTimeEs(iso, kickoffAt);
  if (timePart) {
    return `${datePart} · ${timePart}`;
  }
  return datePart;
}
