// Tipos que mapean los modelos del clinical-api

export type UserRole = "admin" | "therapist" | "viewer";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

/** Respuesta de POST /api/v1/auth/login */
export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  requires_2fa: boolean;
}

export interface ApiErrorBody {
  detail: string;
}

export interface Client {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  num_children: number | null;
  num_siblings: number | null;
  birth_order: number | null;
  predominant_emotions: string[] | null;
  family_abortions: number | null;
  deaths_before_41: string | null;
  important_notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Session {
  id: string;
  client_id: string | null;
  session_date: string;
  session_type: string | null;
  cost: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
