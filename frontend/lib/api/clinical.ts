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
} from '@/types/api';

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
