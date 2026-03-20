import { apiClient } from './client';
import type {
  TherapyType,
  ChakraPosition,
  EnergyDimension,
  ClientListItem,
  CreateSessionPayload,
  UpdateGeneralPayload,
  EnergyReadingPayload,
  ChakraReadingPayload,
  TopicPayload,
  CloseSessionPayload,
  Session,
  ClientTopic,
  SessionThemeEntry,
  ChakraOrgan,
} from '@/types/api';
import { CHAKRA_ORGANS } from '@/lib/data/chakra-organs';

// ─── Catálogos ─────────────────────────────────────────────────────────────────

export async function getTherapyTypes(): Promise<TherapyType[]> {
  return apiClient.get<TherapyType[]>('/api/v1/catalogs/therapy-types');
}

export async function getChakraPositions(): Promise<ChakraPosition[]> {
  return apiClient.get<ChakraPosition[]>('/api/v1/catalogs/chakras');
}

export async function getEnergyDimensions(): Promise<EnergyDimension[]> {
  return apiClient.get<EnergyDimension[]>('/api/v1/catalogs/energy-dimensions');
}

export async function getClientsList(): Promise<ClientListItem[]> {
  const res = await apiClient.get<{ items: ClientListItem[] }>(
    '/api/v1/clinical/clients?per_page=500&sort_by=full_name&sort_order=asc',
  );
  return res.items;
}

export async function searchClients(query: string): Promise<ClientListItem[]> {
  const params = new URLSearchParams({ search: query, per_page: '20', page: '1' });
  const res = await apiClient.get<{ items: ClientListItem[] }>(
    `/api/v1/clinical/clients?${params.toString()}`,
  );
  return res.items;
}

// ─── Wizard de sesión ──────────────────────────────────────────────────────────

export async function createSession(data: CreateSessionPayload): Promise<Session> {
  return apiClient.post<Session, CreateSessionPayload>('/api/v1/clinical/sessions', data);
}

export async function updateSessionGeneral(
  sessionId: string,
  data: UpdateGeneralPayload,
): Promise<Session> {
  return apiClient.patch<Session, UpdateGeneralPayload>(
    `/api/v1/clinical/sessions/${sessionId}/general`,
    data,
  );
}

export async function saveEnergyReadings(
  sessionId: string,
  phase: 'initial' | 'final',
  readings: EnergyReadingPayload[],
): Promise<unknown> {
  return apiClient.put<unknown>(
    `/api/v1/clinical/sessions/${sessionId}/energy/${phase}`,
    { readings },
  );
}

export async function saveChakraReadings(
  sessionId: string,
  phase: 'initial' | 'final',
  readings: ChakraReadingPayload[],
): Promise<unknown> {
  return apiClient.put<unknown>(
    `/api/v1/clinical/sessions/${sessionId}/chakras/${phase}`,
    { readings },
  );
}

export async function saveTopics(
  sessionId: string,
  topics: TopicPayload[],
): Promise<unknown> {
  return apiClient.put<unknown>(
    `/api/v1/clinical/sessions/${sessionId}/topics`,
    { topics },
  );
}

export async function closeSession(
  sessionId: string,
  data: CloseSessionPayload,
): Promise<Session> {
  return apiClient.post<Session, CloseSessionPayload>(
    `/api/v1/clinical/sessions/${sessionId}/close`,
    data,
  );
}

// ─── Temas del paciente ────────────────────────────────────────────────────────

export async function getClientTopics(clientId: string): Promise<ClientTopic[]> {
  return apiClient.get<ClientTopic[]>(`/api/v1/clinical/clients/${clientId}/topics`);
}

export async function createClientTopic(
  clientId: string,
  name: string,
): Promise<ClientTopic> {
  return apiClient.post<ClientTopic, { name: string }>(
    `/api/v1/clinical/clients/${clientId}/topics`,
    { name },
  );
}

export async function updateClientTopic(
  clientId: string,
  topicId: string,
  data: Partial<Pick<ClientTopic, 'progress_pct' | 'is_completed'>>,
): Promise<ClientTopic> {
  return apiClient.patch<ClientTopic, typeof data>(
    `/api/v1/clinical/clients/${clientId}/topics/${topicId}`,
    data,
  );
}

export async function completeClientTopic(
  clientId: string,
  topicId: string,
): Promise<ClientTopic> {
  return updateClientTopic(clientId, topicId, { is_completed: true });
}

export async function deleteClientTopic(
  clientId: string,
  topicId: string,
): Promise<void> {
  return apiClient.delete<void>(
    `/api/v1/clinical/clients/${clientId}/topics/${topicId}`,
  );
}

// ─── Entradas de temas de sesión ──────────────────────────────────────────────

export interface TopicProgressUpdate {
  client_topic_id: string;
  progress_pct: number;
}

export type ThemeEntryType =
  | 'bloqueo_1' | 'bloqueo_2' | 'bloqueo_3'
  | 'resultante' | 'secundario'
  | 'edad_adulta' | 'edad_infancia';

export interface ThemeEntryRow {
  client_topic_id: string | null;
  entry_type: ThemeEntryType;
  // Bloqueos, resultante, secundario
  chakra_position_id?: string | null;
  organ_name?: string | null;
  initial_energy?: number | null;
  final_energy?: number | null;
  // Edad adulta
  adult_theme?: string | null;
  adult_age?: number | null;
  // Edad infancia
  child_theme?: string | null;
  child_age?: number | null;
  // Compartido entre edades
  emotions?: string | null;
  // Bloqueos — Reporte de órganos
  significado?: string | null;
  interpretacion_tema?: string | null;
}

export interface SaveThemeEntriesPayload {
  entries: ThemeEntryRow[];
  topic_progress: TopicProgressUpdate[];
}

export async function saveThemeEntries(
  sessionId: string,
  payload: SaveThemeEntriesPayload,
): Promise<unknown> {
  return apiClient.put<unknown, SaveThemeEntriesPayload>(
    `/api/v1/clinical/sessions/${sessionId}/theme-entries`,
    payload,
  );
}

// ─── LNT ─────────────────────────────────────────────────────────────────────

interface LntItemPayload {
  theme_organ: string | null;
  initial_energy: number | null;
  final_energy: number | null;
  healing_energy_body: boolean | null;
  healing_spiritual_body: boolean | null;
  healing_physical_body: boolean | null;
}

export interface SaveLntPayload {
  entries: LntItemPayload[];
  peticiones?: string;
}

export async function saveLntEntries(
  sessionId: string,
  payload: SaveLntPayload,
): Promise<unknown> {
  return apiClient.put<unknown, SaveLntPayload>(
    `/api/v1/clinical/sessions/${sessionId}/lnt`,
    payload,
  );
}

export async function getThemeEntries(sessionId: string): Promise<SessionThemeEntry[]> {
  return apiClient.get<SessionThemeEntry[]>(
    `/api/v1/clinical/sessions/${sessionId}/theme-entries`,
  );
}

// ─── Catálogo de órganos por chakra ───────────────────────────────────────────

export async function getChakraOrgans(): Promise<ChakraOrgan[]> {
  try {
    return await apiClient.get<ChakraOrgan[]>('/api/v1/catalogs/chakra-organs');
  } catch {
    // Fallback al catálogo estático — mapea posición a ID placeholder
    const result: ChakraOrgan[] = [];
    for (const [posStr, organs] of Object.entries(CHAKRA_ORGANS)) {
      for (const organ of organs) {
        result.push({
          id: organ.id,
          chakra_position_id: posStr,
          organ_name: organ.organ_name,
          system_name: organ.system_name,
        });
      }
    }
    return result;
  }
}
