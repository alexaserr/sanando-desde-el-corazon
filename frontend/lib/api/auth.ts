import type { LoginResponse, User } from "@/types/api";
import { apiClient, ApiError, RateLimitError } from "./client";

export async function loginUser(
  email: string,
  password: string,
): Promise<LoginResponse> {
  try {
    return await apiClient.post<LoginResponse>("/api/v1/auth/login", { email, password });
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
