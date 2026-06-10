import { useCallback, useEffect, useState } from "react";
import {
  checkApiOnline,
  getHomePredictions,
  getOverview,
  getAdminJobs,
  postOddsInitialLoad,
  postOddsUpdateResults,
  runAdminJob,
  syncWorldCup,
  type AdminJobResult,
  type Overview,
} from "../../api/client";
import { ErrorAlert } from "../ErrorAlert";
import {
  JOB_DEFINITIONS,
  JOB_ORDER,
  FALLBACK_JOBS,
  jobDef,
  sortJobs,
  type JobId,
} from "../../lib/adminJobs";

type JobStatus = "idle" | "running" | "ok" | "fail";

type LogEntry = {
  id: string;
  time: string;
  label: string;
  ok: boolean;
  text: string;
};

function formatTime(): string {
  return new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function resultToLog(jobId: string, res: AdminJobResult): LogEntry {
  const def = jobDef(jobId);
  const parts: string[] = [];
  if (res.stdout) parts.push(res.stdout.trim());
  if (res.stderr) parts.push(`STDERR: ${res.stderr.trim()}`);
  if (res.error) parts.push(res.error);
  if (parts.length === 0) parts.push(res.ok ? "Completado sin salida." : "Error sin detalle.");
  return {
    id: `${jobId}-${Date.now()}`,
    time: formatTime(),
    label: def?.label ?? jobId,
    ok: res.ok,
    text: parts.join("\n").slice(0, 3000),
  };
}

export function ConfigPanel() {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [jobStatuses, setJobStatuses] = useState<Record<string, JobStatus>>({});
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [extraRunning, setExtraRunning] = useState<string | null>(null);
  const [jobsLoaded, setJobsLoaded] = useState(false);

  const refreshStatus = useCallback(async () => {
    const [online, ov] = await Promise.all([
      checkApiOnline(),
      getOverview().catch(() => null),
    ]);
    setApiOnline(online);
    setOverview(ov);
  }, []);

  useEffect(() => {
    refreshStatus();
    getAdminJobs()
      .then(() => setJobsLoaded(true))
      .catch(() => setJobsLoaded(false));
  }, [refreshStatus]);

  const pushLog = (entry: LogEntry) => {
    setLogs((prev) => [entry, ...prev].slice(0, 30));
  };

  const runJob = async (jobId: JobId): Promise<AdminJobResult> => {
    setRunningJob(jobId);
    setJobStatuses((s) => ({ ...s, [jobId]: "running" }));
    setError(null);
    try {
      const res = await runAdminJob(jobId);
      setJobStatuses((s) => ({ ...s, [jobId]: res.ok ? "ok" : "fail" }));
      pushLog(resultToLog(jobId, res));
      if (res.ok) await refreshStatus();
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setJobStatuses((s) => ({ ...s, [jobId]: "fail" }));
      const failRes: AdminJobResult = { ok: false, error: msg };
      pushLog(resultToLog(jobId, failRes));
      throw e;
    } finally {
      setRunningJob(null);
    }
  };

  const runPipeline = async () => {
    setPipelineRunning(true);
    setError(null);
    setJobStatuses({});
    for (const id of JOB_ORDER) {
      try {
        const res = await runJob(id);
        if (!res.ok) {
          setError(
            new Error(
              `Pipeline detenido en «${jobDef(id)?.label}». Revisa la consola de salida.`,
            ),
          );
          break;
        }
      } catch {
        setError(
          new Error(`Pipeline detenido en «${jobDef(id)?.label}».`),
        );
        break;
      }
    }
    setPipelineRunning(false);
  };

  const verifyPredictions = async () => {
    setVerifyMsg(null);
    setError(null);
    try {
      const res = await getHomePredictions(7);
      setVerifyMsg(
        `OK — ${res.count ?? res.items.length} partidos, ${res.count_with_prediction ?? 0} con predicción.`,
      );
    } catch (e) {
      setVerifyMsg(null);
      setError(e);
    }
  };

  const runExtra = async (
    key: string,
    label: string,
    fn: () => Promise<{ status?: string; hint?: string; message?: string } & Record<string, unknown>>,
  ) => {
    setExtraRunning(key);
    setError(null);
    try {
      const res = await fn();
      const ok = res.status === "ok" || res.status === "success" || !res.status;
      pushLog({
        id: `${key}-${Date.now()}`,
        time: formatTime(),
        label,
        ok,
        text: JSON.stringify(res, null, 2).slice(0, 2000),
      });
      await refreshStatus();
    } catch (e) {
      pushLog({
        id: `${key}-${Date.now()}`,
        time: formatTime(),
        label,
        ok: false,
        text: e instanceof Error ? e.message : String(e),
      });
      setError(e);
    } finally {
      setExtraRunning(null);
    }
  };

  const anyRunning = runningJob !== null || pipelineRunning || extraRunning !== null;
  const model = overview?.active_model;
  const completedSteps = JOB_ORDER.filter((id) => jobStatuses[id] === "ok").length;

  return (
    <div className="config-panel">
      {/* Estado del sistema */}
      <section className="config-status-row">
        <div className={`config-status-card ${apiOnline ? "ok" : "fail"}`}>
          <span className="config-status-label">API</span>
          <strong>{apiOnline === null ? "…" : apiOnline ? "Online" : "Offline"}</strong>
        </div>
        <div className={`config-status-card ${model ? "ok" : "warn"}`}>
          <span className="config-status-label">Modelo 1X2</span>
          <strong>{model ? model.version : "Sin entrenar"}</strong>
          {model && (
            <span className="muted small">{model.algorithm}</span>
          )}
        </div>
        <div className="config-status-card">
          <span className="config-status-label">Equipos</span>
          <strong>{overview?.teams ?? "—"}</strong>
        </div>
        <div className="config-status-card">
          <span className="config-status-label">Partidos BD</span>
          <strong>{overview?.matches ?? "—"}</strong>
        </div>
        <div className="config-status-card">
          <span className="config-status-label">Ratings Elo</span>
          <strong>{overview?.elo_ratings ?? "—"}</strong>
        </div>
      </section>

      {!jobsLoaded && (
        <div className="banner">
          No se pudo listar jobs desde la API — usando definiciones locales. ¿Está
          corriendo el backend en :8888?
        </div>
      )}

      {/* Pipeline */}
      <section className="card config-pipeline">
        <header className="config-section-head">
          <div>
            <h2>Pipeline de predicciones</h2>
            <p className="muted small">
              Ejecuta en orden: base de datos → datos → modelo → calendario → cuotas.
              {completedSteps > 0 && ` · ${completedSteps}/${JOB_ORDER.length} completados`}
            </p>
          </div>
          <div className="config-pipeline-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={runPipeline}
              disabled={anyRunning || !apiOnline}
            >
              {pipelineRunning ? "Ejecutando pipeline…" : "Ejecutar todo (1→5)"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={verifyPredictions}
              disabled={anyRunning || !apiOnline}
            >
              Verificar predicciones
            </button>
            <button type="button" className="btn" onClick={refreshStatus} disabled={anyRunning}>
              Actualizar estado
            </button>
          </div>
        </header>

        {verifyMsg && <div className="banner">{verifyMsg}</div>}
        {error != null && <ErrorAlert error={error} />}

        <div className="config-stepper">
          {JOB_DEFINITIONS.map((job, i) => {
            const status = jobStatuses[job.id] ?? "idle";
            return (
              <div key={job.id} className="config-step-wrap">
                {i > 0 && (
                  <span
                    className={`config-step-line ${jobStatuses[JOB_ORDER[i - 1]] === "ok" ? "done" : ""}`}
                    aria-hidden
                  />
                )}
                <div className={`config-step config-step--${status}`}>
                  <span className="config-step-num">{job.step}</span>
                  <span className="config-step-short">{job.shortLabel}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="config-jobs-list">
          {JOB_DEFINITIONS.map((job) => {
            const status = jobStatuses[job.id] ?? "idle";
            const meta = sortJobs(FALLBACK_JOBS).find((j) => j.id === job.id);
            return (
              <article key={job.id} className={`config-job-card config-job-card--${status}`}>
                <div className="config-job-main">
                  <div className="config-job-head">
                    <span className="config-job-step">Paso {job.step}</span>
                    <h3>{job.label}</h3>
                    <span className={`config-job-badge config-job-badge--${status}`}>
                      {status === "idle" && "Pendiente"}
                      {status === "running" && "Ejecutando…"}
                      {status === "ok" && "Completado"}
                      {status === "fail" && "Error"}
                    </span>
                  </div>
                  <p className="muted small config-job-desc">{job.description}</p>
                  <div className="config-job-meta">
                    <span>⏱ {job.duration}</span>
                    <span>→ {job.requiredFor}</span>
                  </div>
                  <code className="config-job-cmd">{meta?.console ?? job.console}</code>
                </div>
                <button
                  type="button"
                  className="btn btn-primary config-job-run"
                  disabled={anyRunning || !apiOnline}
                  onClick={() => runJob(job.id)}
                >
                  {runningJob === job.id ? "Ejecutando…" : "Ejecutar"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {/* Sincronización extra */}
      <section className="card config-extra">
        <h2 className="section-title">Sincronización adicional</h2>
        <p className="muted small">
          Acciones puntuales fuera del pipeline principal.
        </p>
        <div className="config-extra-grid">
          <button
            type="button"
            className="config-extra-btn"
            disabled={anyRunning || !apiOnline}
            onClick={() =>
              runExtra("sync-wc", "Sync Mundial 2026", syncWorldCup)
            }
          >
            <strong>Mundial 2026</strong>
            <span className="muted small">Calendario Copa del Mundo</span>
            {extraRunning === "sync-wc" && <span className="job-spinner">…</span>}
          </button>
          <button
            type="button"
            className="config-extra-btn"
            disabled={anyRunning || !apiOnline}
            onClick={() =>
              runExtra("odds-load", "Carga cuotas", postOddsInitialLoad)
            }
          >
            <strong>Recargar cuotas</strong>
            <span className="muted small">The Odds API — volcado</span>
            {extraRunning === "odds-load" && <span className="job-spinner">…</span>}
          </button>
          <button
            type="button"
            className="config-extra-btn"
            disabled={anyRunning || !apiOnline}
            onClick={() =>
              runExtra("odds-results", "Actualizar resultados", () =>
                postOddsUpdateResults(14),
              )
            }
          >
            <strong>Resultados cuotas</strong>
            <span className="muted small">Últimos 14 días</span>
            {extraRunning === "odds-results" && <span className="job-spinner">…</span>}
          </button>
        </div>
      </section>

      {/* Modelo activo */}
      {model && (
        <section className="card config-model-detail">
          <h2 className="section-title section-title--gold">Modelo activo</h2>
          <div className="config-model-grid">
            <div>
              <span className="muted small">Versión</span>
              <strong>{model.version}</strong>
            </div>
            <div>
              <span className="muted small">Algoritmo</span>
              <strong>{model.algorithm}</strong>
            </div>
            <div>
              <span className="muted small">Entrenado</span>
              <strong>{new Date(model.trained_at).toLocaleString("es-ES")}</strong>
            </div>
            {Object.entries(model.metrics).slice(0, 4).map(([k, v]) => (
              <div key={k}>
                <span className="muted small">{k}</span>
                <strong>{typeof v === "number" ? v.toFixed(4) : String(v)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Consola */}
      <section className="card config-console">
        <header className="config-section-head">
          <h2>Consola de salida</h2>
          {logs.length > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => setLogs([])}>
              Limpiar
            </button>
          )}
        </header>
        {logs.length === 0 ? (
          <p className="muted small config-console-empty">
            La salida de cada script aparecerá aquí.
          </p>
        ) : (
          <div className="config-log-list">
            {logs.map((log) => (
              <div key={log.id} className={`config-log-entry ${log.ok ? "ok" : "fail"}`}>
                <header className="config-log-head">
                  <span className="config-log-time">{log.time}</span>
                  <strong>{log.label}</strong>
                  <span className={`config-log-status ${log.ok ? "ok" : "fail"}`}>
                    {log.ok ? "OK" : "ERROR"}
                  </span>
                </header>
                <pre>{log.text}</pre>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
