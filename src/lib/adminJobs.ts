import type { AdminJobMeta } from "../api/client";

export const JOB_ORDER = [
  "ensure-db",
  "ingest",
  "train",
  "sync-fixtures",
  "sync-odds",
] as const;

export type JobId = (typeof JOB_ORDER)[number];

export type JobDefinition = {
  id: JobId;
  label: string;
  shortLabel: string;
  step: number;
  description: string;
  duration: string;
  requiredFor: string;
  console: string;
};

export const JOB_DEFINITIONS: JobDefinition[] = [
  {
    id: "ensure-db",
    label: "Crear base de datos",
    shortLabel: "BD",
    step: 1,
    description: "Crea la base MySQL jubiladora si no existe.",
    duration: "~10 s",
    requiredFor: "Todo lo demás",
    console: "php bin/console jubiladora:ensure-db",
  },
  {
    id: "ingest",
    label: "Cargar CSV históricos",
    shortLabel: "CSV",
    step: 2,
    description: "Importa partidos históricos y ratings Elo a MySQL.",
    duration: "2–10 min",
    requiredFor: "Entrenar modelo",
    console: "php bin/console jubiladora:ingest",
  },
  {
    id: "train",
    label: "Entrenar modelo 1X2",
    shortLabel: "ML",
    step: 3,
    description: "Entrena XGBoost para pronósticos 1X2 (local / empate / visitante).",
    duration: "1–3 min",
    requiredFor: "Pronósticos y apuestas",
    console: "php bin/console jubiladora:train",
  },
  {
    id: "sync-fixtures",
    label: "Sincronizar calendario",
    shortLabel: "Cal",
    step: 4,
    description: "Descarga fixtures futuros desde APIs externas (Mundial, ligas).",
    duration: "1–5 min",
    requiredFor: "Calendario y partidos próximos",
    console: "php bin/console jubiladora:sync-fixtures",
  },
  {
    id: "sync-odds",
    label: "Sincronizar cuotas",
    shortLabel: "Odds",
    step: 5,
    description: "Volcado inicial de cuotas The Odds API para mercados de apuestas.",
    duration: "2–8 min",
    requiredFor: "Centro de apuestas",
    console: "php bin/console jubiladora:sync-odds",
  },
];

export const FALLBACK_JOBS: AdminJobMeta[] = JOB_DEFINITIONS.map((j) => ({
  id: j.id,
  label: j.label,
  console: j.console,
  http: `POST /api/v1/admin/jobs/${j.id}`,
}));

export function sortJobs(jobs: AdminJobMeta[]): AdminJobMeta[] {
  return [...jobs].sort((a, b) => {
    const ia = JOB_ORDER.indexOf(a.id as JobId);
    const ib = JOB_ORDER.indexOf(b.id as JobId);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export function jobDef(id: string): JobDefinition | undefined {
  return JOB_DEFINITIONS.find((j) => j.id === id);
}
