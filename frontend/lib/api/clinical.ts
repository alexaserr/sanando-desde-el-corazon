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
  const res = await apiClient.get<{ data: TherapyType[] }>('/api/v1/catalogs/therapy-types');
  return res.data;
}

export async function getChakraPositions(): Promise<ChakraPosition[]> {
  const res = await apiClient.get<{ data: ChakraPosition[] }>('/api/v1/catalogs/chakras');
  return res.data;
}

export async function getEnergyDimensions(): Promise<EnergyDimension[]> {
  const res = await apiClient.get<{ data: EnergyDimension[] }>('/api/v1/catalogs/energy-dimensions');
  return res.data;
}

export async function getClientsList(): Promise<ClientListItem[]> {
  const res = await apiClient.get<{ data: ClientListItem[] }>(
    '/api/v1/clinical/clients?per_page=500&sort_by=full_name&sort_order=asc',
  );
  return res.data;
}

// ─── Wizard de sesión ──────────────────────────────────────────────────────────

export async function createSession(data: CreateSessionPayload): Promise<Session> {
  const res = await apiClient.post<{ data: Session }, CreateSessionPayload>(
    '/api/v1/clinical/sessions',
    data,
  );
  return res.data;
}

export async function updateSessionGeneral(
  sessionId: string,
  data: UpdateGeneralPayload,
): Promise<Session> {
  const res = await apiClient.patch<{ data: Session }, UpdateGeneralPayload>(
    `/api/v1/clinical/sessions/${sessionId}/general`,
    data,
  );
  return res.data;
}

export async function saveEnergyReadings(
  sessionId: string,
  phase: 'initial' | 'final',
  readings: EnergyReadingPayload[],
): Promise<unknown> {
  const res = await apiClient.put<{ data: unknown }>(
    `/api/v1/clinical/sessions/${sessionId}/energy/${phase}`,
    { readings },
  );
  return res.data;
}

export async function saveChakraReadings(
  sessionId: string,
  phase: 'initial' | 'final',
  readings: ChakraReadingPayload[],
): Promise<unknown> {
  const res = await apiClient.put<{ data: unknown }>(
    `/api/v1/clinical/sessions/${sessionId}/chakras/${phase}`,
    { readings },
  );
  return res.data;
}

export async function saveTopics(
  sessionId: string,
  topics: TopicPayload[],
): Promise<unknown> {
  const res = await apiClient.put<{ data: unknown }>(
    `/api/v1/clinical/sessions/${sessionId}/topics`,
    { topics },
  );
  return res.data;
}

export async function closeSession(
  sessionId: string,
  data: CloseSessionPayload,
): Promise<Session> {
  const res = await apiClient.post<{ data: Session }, CloseSessionPayload>(
    `/api/v1/clinical/sessions/${sessionId}/close`,
    data,
  );
  return res.data;
}
