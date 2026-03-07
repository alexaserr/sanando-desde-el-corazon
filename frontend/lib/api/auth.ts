import type { LoginResponse, User } from "@/types/api";
import { apiClient, ApiError, RateLimitError } from "./client";

/**
 * Llama a POST /api/v1/auth/login (OAuth2PasswordRequestForm).
 * El backend responde con access_token en body y refresh_token en cookie HttpOnly.
 */
export async function loginUser(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);

  try {
    return await apiClient.postForm<LoginResponse>("/api/v1/auth/login", form);
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    if (err instanceof ApiError) throw new Error(err.message);
    throw new Error("Error de red. Intente de nuevo.");
  }
}

export async function logoutUser(): Promise<void> {
  await apiClient.post<void>("/api/v1/auth/logout");
}

export async function getMe(): Promise<User> {
  return apiClient.get<User>("/api/v1/users/me");
}
