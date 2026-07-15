import { buildVocabShareUrl } from '@/constants/viral';
import type {
  VocabShareCreateRequest,
  VocabShareCreateResponse,
  VocabShareErrorBody,
  VocabShareGetResponse,
} from '@/types/vocab-share-api';

import {
  COMPANION_API_URL_MISSING,
  companionApiRequestHeaders,
  getCompanionChatApiBaseUrl,
} from '@/utils/companion-api-config';

function getApiBaseUrl(): string {
  try {
    return getCompanionChatApiBaseUrl();
  } catch {
    throw new Error(COMPANION_API_URL_MISSING);
  }
}

export async function postVocabShare(body: VocabShareCreateRequest): Promise<VocabShareCreateResponse> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/vocab/share`, {
    method: 'POST',
    headers: companionApiRequestHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = json as Partial<VocabShareErrorBody>;
    throw new Error(err.error || `Ошибка сервера (${res.status})`);
  }
  const data = json as VocabShareCreateResponse;
  if (!data.id) throw new Error('Invalid share response');
  return { id: data.id, url: data.url || buildVocabShareUrl(data.id) };
}

export async function fetchSharedVocabPack(shareId: string): Promise<VocabShareGetResponse> {
  const base = getApiBaseUrl();
  const id = encodeURIComponent(shareId.trim());
  const res = await fetch(`${base}/api/vocab/share/${id}`, {
    method: 'GET',
    headers: companionApiRequestHeaders(),
  });
  const raw = await res.text();
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = json as Partial<VocabShareErrorBody>;
    throw new Error(err.error || `Ошибка сервера (${res.status})`);
  }
  const data = json as VocabShareGetResponse;
  if (!data.name || !Array.isArray(data.cards)) throw new Error('Invalid pack payload');
  return data;
}
