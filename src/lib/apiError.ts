/** Error enriquecido devuelto por el cliente API. */
export class ApiError extends Error {
  readonly httpStatus?: number;
  readonly path?: string;
  readonly detail?: string;
  readonly rawBody?: string;

  constructor(
    message: string,
    opts?: {
      httpStatus?: number;
      path?: string;
      detail?: string;
      rawBody?: string;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.httpStatus = opts?.httpStatus;
    this.path = opts?.path;
    this.detail = opts?.detail;
    this.rawBody = opts?.rawBody;
  }
}

export type ErrorDisplay = {
  title: string;
  status?: number;
  statusLabel?: string;
  path?: string;
  detail: string;
  hint?: string;
  raw?: string;
};

const STATUS_LABELS: Record<number, string> = {
  400: "Bad Request — petición inválida",
  401: "Unauthorized — no autorizado",
  403: "Forbidden — acceso denegado",
  404: "Not Found — recurso no encontrado",
  422: "Unprocessable Entity — validación fallida",
  500: "Internal Server Error — fallo en el servidor",
  502: "Bad Gateway — proxy no alcanza el backend",
  503: "Service Unavailable — servicio no disponible",
};

function statusLabel(code: number): string {
  return STATUS_LABELS[code] ?? `HTTP ${code}`;
}

function hintForStatus(code: number, path?: string): string {
  if (code === 404 && path?.includes("predictions")) {
    return "Puede que falte el modelo entrenado. Ve a Configuración → pipeline (paso 3: Entrenar).";
  }
  if (code === 422 && path?.includes("days")) {
    return "Comprueba los parámetros (p. ej. days máximo 7 en pronósticos).";
  }
  if (code === 500) {
    return "Revisa la consola del backend (run-api.ps1). Suele deberse a datos incompletos, modelo sin entrenar o un bug en esa ruta. Prueba Configuración → ejecutar pipeline.";
  }
  if (code === 502 || code === 503) {
    return "¿Está corriendo el backend en http://127.0.0.1:8888? Ejecuta scripts/run-api.ps1.";
  }
  return "Si persiste, abre Configuración y verifica el estado de la API.";
}

/** Parsea cuerpo JSON de error FastAPI / Symfony / texto plano. */
export function parseErrorBody(text: string, fallback: string): string {
  if (!text.trim()) return fallback;
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((d) =>
          typeof d === "object" && d && "msg" in d
            ? String((d as { msg: string }).msg)
            : JSON.stringify(d),
        )
        .join("; ");
    }
    if (typeof body.message === "string") return body.message;
    if (typeof body.error === "string") return body.error;
    return fallback;
  } catch {
    const trimmed = text.trim();
    if (trimmed.toLowerCase() === "internal server error") {
      return "Internal Server Error (sin detalle en el cuerpo de la respuesta)";
    }
    return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
  }
}

export function buildApiError(
  httpStatus: number,
  path: string,
  rawBody: string,
): ApiError {
  const fallback = `${httpStatus} ${path}`;
  const detail = parseErrorBody(rawBody, fallback);
  const label = statusLabel(httpStatus);
  const summary = `Error ${httpStatus} — ${label.split(" — ")[1] ?? label}`;
  const message = rawBody.trim().toLowerCase() === "internal server error" && detail.includes("sin detalle")
    ? `${summary} en ${path}`
    : detail !== fallback
      ? detail
      : `${summary} en ${path}`;

  return new ApiError(message, {
    httpStatus,
    path,
    detail: detail !== fallback ? detail : undefined,
    rawBody: rawBody.slice(0, 2000) || undefined,
  });
}

/** Convierte cualquier error a estructura para la UI. */
export function toErrorDisplay(err: unknown): ErrorDisplay {
  if (err instanceof ApiError) {
    const code = err.httpStatus;
    return {
      title: code ? `Error ${code}` : "Error de API",
      status: code,
      statusLabel: code ? statusLabel(code) : undefined,
      path: err.path,
      detail: err.detail ?? err.message,
      hint: code ? hintForStatus(code, err.path) : err.message,
      raw: err.rawBody,
    };
  }

  const msg = err instanceof Error ? err.message : String(err);
  const statusMatch = msg.match(/^(\d{3})\s+(\S+)/);
  const code = statusMatch ? Number(statusMatch[1]) : undefined;
  const pathMatch = msg.match(/(\/api\/v1\/[^\s]+)/);
  const path = pathMatch?.[1];
  const isInternal = msg.toLowerCase().includes("internal server");

  return {
    title: code ? `Error ${code}` : isInternal ? "Error 500" : "Error",
    status: code ?? (isInternal ? 500 : undefined),
    statusLabel: code ? statusLabel(code) : isInternal ? statusLabel(500) : undefined,
    path,
    detail: msg,
    hint: code ? hintForStatus(code, path) : isInternal ? hintForStatus(500, path) : undefined,
  };
}
