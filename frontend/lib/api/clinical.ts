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

// ─── Entradas de temas de sesión ──────────────────────────────────────────────

interface TopicProgressUpdate {
  topic_id: string;
  progress_pct: number;
}

interface SaveThemeEntriesPayload {
  entries: Omit<SessionThemeEntry, 'id' | 'session_id' | 'created_at' | 'updated_at'>[];
  topic_progress: TopicProgressUpdate[];
}

export async function saveThemeEntries(
  sessionId: string,
  entries: SaveThemeEntriesPayload['entries'],
  topicProgress: TopicProgressUpdate[],
): Promise<unknown> {
  return apiClient.put<unknown, SaveThemeEntriesPayload>(
    `/api/v1/clinical/sessions/${sessionId}/theme-entries`,
    { entries, topic_progress: topicProgress },
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
