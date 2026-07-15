import { getCompanionChatApiBaseUrl } from '@/utils/companion-api-config';

/** HTTP API base → WebSocket URL для голосового звонка. */
export function companionRealtimeWsUrl(): string {
  const normalized = getCompanionChatApiBaseUrl();
  if (normalized.startsWith('https://')) {
    return `${normalized.replace('https://', 'wss://')}/ws/companion-realtime`;
  }
  if (normalized.startsWith('http://')) {
    return `${normalized.replace('http://', 'ws://')}/ws/companion-realtime`;
  }
  return `ws://${normalized}/ws/companion-realtime`;
}
