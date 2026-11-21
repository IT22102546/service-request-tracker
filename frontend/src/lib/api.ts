import type { ApiErrorBody } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Fired when the API answers 401 so the auth context can drop the user. */
export const UNAUTHENTICATED_EVENT = "api:unauthenticated";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.message || `Request failed (${status})`);
  }

  get code() {
    return this.body.code;
  }

  /** First validation message per field, convenient for forms. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [field, messages] of Object.entries(this.body.errors ?? {})) {
      if (messages.length) out[field] = messages[0];
    }
    return out;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

/** Ask Laravel for the XSRF-TOKEN cookie (Sanctum SPA CSRF protection). */
export async function ensureCsrfCookie(force = false) {
  if (!force && readCookie("XSRF-TOKEN")) return;
  await fetch(`${API_URL}/sanctum/csrf-cookie`, { credentials: "include" });
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Thin fetch wrapper: sends the session cookie, attaches the CSRF header on
 * mutating calls, retries once on 419 (expired CSRF token) and turns every
 * non-2xx answer into an ApiError carrying the JSON error envelope.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  if (MUTATING.has(method)) {
    await ensureCsrfCookie();
    const token = readCookie("XSRF-TOKEN");
    if (token) headers.set("X-XSRF-TOKEN", token);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, method, headers, credentials: "include" });
  } catch {
    throw new ApiError(0, { message: "Cannot reach the server. Check your connection and try again.", code: "NETWORK_ERROR" });
  }

  if (res.status === 419 && !retried) {
    await ensureCsrfCookie(true);
    return apiFetch<T>(path, init, true);
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const errorBody: ApiErrorBody =
      body && typeof body === "object" && "message" in body
        ? (body as ApiErrorBody)
        : { message: `Unexpected server error (${res.status}).`, code: `HTTP_${res.status}` };

    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
    }
    throw new ApiError(res.status, errorBody);
  }

  return body as T;
}

export function jsonBody(data: unknown): RequestInit["body"] {
  return JSON.stringify(data);
}
