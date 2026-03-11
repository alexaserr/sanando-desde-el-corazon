import type { User } from "@/types/api";
import { useAuthStore } from "@/store/auth";
import { apiClient, ApiError, RateLimitError } from "./client";

export async function loginUser(email: string, password: string): Promise<User> {
  try {
    const res = await apiClient.post<{ access_token: string; token_type: string; requires_2fa: boolean }>(
      "/api/v1/auth/login",
      { email, password },
    );
    const { access_token } = res;
    // Guardar token en memoria para que getMe() lo use en el header Authorization
    useAuthStore.getState().setAccessToken(access_token);
    const user = await getMe();
    useAuthStore.getState().setAuth(user, access_token);
    return user;
  } catch (err) {
    useAuthStore.getState().logout();
    if (err instanceof RateLimitError) throw err;
    if (err instanceof ApiError) throw new Error(err.message);
    throw new Error("Error de red. Intente de nuevo.");
  }
}

export async function logoutUser(): Promise<void> {
  await apiClient.post<void>("/api/v1/auth/logout");
}

export async function getMe(): Promise<User> {
  const res = await apiClient.get<{ data: User }>("/api/v1/auth/me");
  return res.data;
}
