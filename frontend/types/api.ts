// Tipos que mapean los modelos del clinical-api

export type UserRole = "admin" | "therapist" | "viewer";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  has_2fa: boolean;
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

export type MaritalStatus =
  | "single"
  | "married"
  | "divorced"
  | "widowed"
  | "common_law"
  | "other";

export interface Client {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  marital_status: MaritalStatus | null;
  birth_place: string | null;
  residence_place: string | null;
  profession: string | null;
  motivation_visit: string[] | null;
  motivation_general: string | null;
  num_children: number | null;
  num_siblings: number | null;
  birth_order: number | null;
  predominant_emotions: string[] | null;
  family_abortions: string | null;
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
  measured_at: string | null;
  session_type: string | null;
  status: string | null;
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

// ─── Catálogos clínicos ────────────────────────────────────────────────────────

export interface TherapyType {
  id: string;
  name: string;
  description: string | null;
}

export interface ChakraPosition {
  id: string;
  name: string;
  position: number;
}

export interface EnergyDimension {
  id: string;
  name: string;
  is_active: boolean;
}

export interface ClientListItem {
  id: string;
  full_name: string;
}

// ─── Payloads del wizard de sesión ────────────────────────────────────────────

export interface CreateSessionPayload {
  client_id: string;
  therapy_type_id: string;
  measured_at?: string;
  notes?: string;
}

export interface UpdateGeneralPayload {
  general_energy_level: number;
  notes?: string;
  cost?: number;
  payment_notes?: string;
}

export interface EnergyReadingPayload {
  dimension_id: string;
  value: number;
}

export interface ChakraReadingPayload {
  chakra_position_id: string;
  value: number;
}

export interface TopicPayload {
  source_type: string;
  zone: string;
  adult_theme: string;
  child_theme: string;
  adult_age: number | null;
  child_age: number | null;
  emotions: string;
  initial_energy: number;
  final_energy: number;
}

export interface CloseSessionPayload {
  cost: number;
  payment_notes?: string;
}
