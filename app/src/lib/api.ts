import { toast } from "sonner";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

/**
 * Same-origin API call against the worker backend.
 * Session cookie (tpc_session) rides along via credentials: "same-origin".
 * Any 401 redirects to the login page (except auth endpoints, which the
 * caller handles itself to avoid redirect loops).
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    if (!path.startsWith("/api/auth/") && !window.location.pathname.endsWith("/login")) {
      window.location.assign("/login");
    }
    throw new ApiError("unauthorized", 401);
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(typeof data.error === "string" ? data.error : res.statusText, res.status);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Toast for a failed API action. 403s get a friendly "not authorized"
 * message (the backend rejects role-inappropriate actions with 403);
 * anything else shows the prefix plus the server error.
 */
export function toastApiError(err: unknown, prefix: string): void {
  if (err instanceof ApiError && err.status === 403) {
    toast.error("Not authorized — your role doesn't allow this action.");
    return;
  }
  toast.error(`${prefix}: ${errorMessage(err)}`);
}
