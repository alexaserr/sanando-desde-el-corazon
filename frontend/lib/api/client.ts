import { useAuthStore } from "@/store/auth";

// URLs relativas → el proxy de Next.js (next.config.js) las reescribe al backend.
// No usar NEXT_PUBLIC_CLINICAL_API_URL para evitar requests cross-origin que
// impiden el envío de cookies HttpOnly.
const BASE_URL = "";

// Shared promise to prevent concurrent token-refresh races.
// If multiple 401s fire simultaneously, all callers await the same promise.
let refreshPromise: Promise<string> | null = null;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class RateLimitError extends Error {
  constructor() {
    super("Demasiadas solicitudes. Por favor espere un momento.");
    this.name = "RateLimitError";
  }
}

// ---------------------------------------------------------------------------
// Core request function
// ---------------------------------------------------------------------------

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  formBody?: URLSearchParams;
};

async function request<TResponse>(
  path: string,
  { body, formBody, headers: extraHeaders, ...rest }: RequestOptions = {},
  _retried = false,
): Promise<TResponse> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(extraHeaders as HeadersInit | undefined);

  if (formBody !== undefined) {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  } else if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
    credentials: "include",
    body:
      formBody !== undefined
        ? formBody.toString()
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
  });

  if (response.status === 401 && !_retried) {
    // Intentar renovar el access_token con la cookie refresh_token.
    // Usar refreshPromise compartido para evitar race conditions cuando
    // múltiples requests fallan con 401 simultáneamente.
    try {
      if (!refreshPromise) {
        refreshPromise = fetch(`${BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          credentials: "include",
        })
          .then((res) => {
            if (!res.ok) throw new Error("Refresh failed");
            return res.json() as Promise<{ data: { access_token: string } }>;
          })
          .then(({ data }) => {
            useAuthStore.getState().setAccessToken(data.access_token);
            return data.access_token;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      await refreshPromise;
      // Reintentar la request original una sola vez
      return request<TResponse>(path, { body, formBody, headers: extraHeaders, ...rest }, true);
    } catch {
      // refresh falló — continuar a logout
    }

    // Refresh fallido → limpiar sesión y redirigir
    useAuthStore.getState().logout();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError(401, "Sesión expirada");
  }

  if (response.status === 401) {
    // Ya se intentó el refresh — limpiar sesión
    useAuthStore.getState().logout();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError(401, "Sesión expirada");
  }

  if (response.status === 429) {
    throw new RateLimitError();
  }

  if (!response.ok) {
    let detail = `Error ${response.status}`;
    try {
      const errBody = (await response.json()) as { detail?: string };
      if (typeof errBody.detail === "string") detail = errBody.detail;
    } catch {
      // response body no es JSON válido
    }
    throw new ApiError(response.status, detail);
  }

  if (
    response.status === 204 ||
    response.headers.get("Content-Length") === "0"
  ) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const apiClient = {
  get<TResponse>(path: string, options?: Omit<RequestOptions, "body" | "formBody">) {
    return request<TResponse>(path, { ...options, method: "GET" });
  },

  post<TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<RequestOptions, "body" | "formBody">) {
    return request<TResponse>(path, { ...options, method: "POST", body });
  },

  postForm<TResponse>(path: string, form: URLSearchParams) {
    return request<TResponse>(path, { method: "POST", formBody: form });
  },

  put<TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<RequestOptions, "body" | "formBody">) {
    return request<TResponse>(path, { ...options, method: "PUT", body });
  },

  patch<TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<RequestOptions, "body" | "formBody">) {
    return request<TResponse>(path, { ...options, method: "PATCH", body });
  },

  delete<TResponse>(path: string, options?: Omit<RequestOptions, "body" | "formBody">) {
    return request<TResponse>(path, { ...options, method: "DELETE" });
  },

  /** Return the raw Response (for file downloads, blobs, etc.). */
  async raw(path: string, options?: Omit<RequestOptions, "body" | "formBody"> & { method?: string }): Promise<Response> {
    const token = useAuthStore.getState().accessToken;
    const headers = new Headers(options?.headers as HeadersInit | undefined);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
    if (!response.ok) {
      throw new ApiError(response.status, `Error ${response.status}`);
    }
    return response;
  },
};
