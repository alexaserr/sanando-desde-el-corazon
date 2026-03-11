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

// ─── Subtipos embebidos en Client ─────────────────────────────────────────────

export interface ClientCondition {
  id: string;
  client_id: string;
  condition_type: string;
  description: string;
  created_at: string;
  deleted_at: string | null;
}

export interface ClientMedication {
  id: string;
  client_id: string;
  name: string;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
}

export type SleepQuality = "bad" | "regular" | "good" | "excellent";

export interface ClientSleep {
  id: string;
  client_id: string;
  avg_hours: number;
  quality: SleepQuality;
  created_at: string;
}

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
  family_abortions: number | null;
  deaths_before_41: string | null;
  important_notes: string | null;
  // Relaciones embebidas
  conditions: ClientCondition[];
  pains: ClientCondition[];
  medications: ClientMedication[];
  sleep: ClientSleep | null;
  family_members: ClientCondition[];
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

/** Detalle extendido de sesión — superset de Session */
export interface SessionDetail extends Session {
  general_energy_level: number | null;
  payment_notes: string | null;
}

/** Item de sesión en el historial de un paciente */
export interface ClientSessionItem {
  id: string;
  measured_at: string;
  therapy_type_name: string | null;
  cost: number | null;
  notes: string | null;
  general_energy_level: number | null;
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
  color: string;
}

export interface EnergyDimension {
  id: string;
  name: string;
  display_order: number;
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
  entities_count?: number | null;
  implants_count?: number | null;
  total_cleanings?: number | null;
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

// ─── Temas del paciente ────────────────────────────────────────────────────────

export interface ClientTopic {
  id: string;
  client_id: string;
  name: string;
  progress_pct: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

// ─── Entradas de temas de sesión ──────────────────────────────────────────────

export interface SessionThemeEntry {
  id: string;
  session_id: string;
  topic_id: string | null;
  topic_name: string;
  is_secondary: boolean;
  blockage_1_chakra_id: string | null;
  blockage_1_organ: string | null;
  blockage_1_energy: number | null;
  blockage_2_chakra_id: string | null;
  blockage_2_organ: string | null;
  blockage_2_energy: number | null;
  blockage_3_chakra_id: string | null;
  blockage_3_organ: string | null;
  blockage_3_energy: number | null;
  resultant_chakra_id: string | null;
  resultant_organ: string | null;
  resultant_energy: number | null;
  secondary_energy_initial: number | null;
  secondary_energy_final: number | null;
  childhood_place: string | null;
  childhood_people: string | null;
  childhood_situation: string | null;
  childhood_description: string | null;
  childhood_emotions: string | null;
  adulthood_place: string | null;
  adulthood_people: string | null;
  adulthood_situation: string | null;
  adulthood_description: string | null;
  adulthood_emotions: string | null;
  progress_pct: number;
  created_at: string;
  updated_at: string;
}

// ─── Catálogo de órganos por chakra ───────────────────────────────────────────

export interface ChakraOrgan {
  id: string;
  chakra_position_id: string;
  organ_name: string;
  system_name: string;
}
