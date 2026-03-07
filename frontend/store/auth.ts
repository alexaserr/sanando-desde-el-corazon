import { create } from "zustand";
import type { User } from "@/types/api";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** true cuando el backend pide segundo factor antes de dar acceso completo */
  requires2fa: boolean;

  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  setRequires2fa: (value: boolean) => void;
  logout: () => void;
}

// Token solo en memoria — nunca en localStorage ni sessionStorage
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  requires2fa: false,

  setAuth: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true, requires2fa: false }),

  setAccessToken: (token) => set({ accessToken: token }),

  setRequires2fa: (value) => set({ requires2fa: value }),

  logout: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      requires2fa: false,
    }),
}));
