import { useAuthStore } from "@/store/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

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
    credentials: "include", // envía la cookie refresh_token
    body: formBody !== undefined
      ? formBody.toString()
      : body !== undefined
        ? JSON.stringify(body)
        : undefined,
  });

  if (response.status === 401) {
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

  // 204 No Content o body vacío
  if (response.status === 204 || response.headers.get("Content-Length") === "0") {
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

  /** Para endpoints que esperan application/x-www-form-urlencoded (e.g. OAuth2PasswordRequestForm) */
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
};
