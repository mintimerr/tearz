type AuthErrorBody = { error?: string };
type SendCodeSuccess = { ok: true; devCode?: string; delivery?: 'dev' | 'email' };

import { getCompanionChatApiBaseUrl } from '@/utils/companion-api-config';
import { postCompanionApiJson, warmCompanionApi } from '@/utils/companion-api-fetch';

function getApiBaseUrl(): string {
  try {
    return getCompanionChatApiBaseUrl();
  } catch {
    throw new Error('auth.errorServer');
  }
}

async function parseJson(res: Response): Promise<unknown> {
  const raw = await res.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw.slice(0, 120) || 'auth.errorServer');
  }
}

async function authFetch(path: string, body: unknown): Promise<Response> {
  let base: string;
  try {
    base = getApiBaseUrl();
  } catch (e) {
    throw e instanceof Error ? e : new Error('auth.errorServer');
  }

  try {
    return await postCompanionApiJson(path, body, { timeoutMs: 45_000, retries: 3 });
  } catch {
    throw new Error(`auth.errorServerUnreachable|${base}`);
  }
}

export { warmCompanionApi };

export async function postAuthSendCode(
  email: string,
  options?: { displayName?: string; purpose?: 'signIn' | 'signUp' },
): Promise<SendCodeSuccess> {
  const res = await authFetch('/api/auth/send-code', {
    email,
    displayName: options?.displayName,
    purpose: options?.purpose ?? 'signUp',
  });
  const json = (await parseJson(res)) as Partial<SendCodeSuccess & AuthErrorBody>;
  if (!res.ok) {
    throw new Error(json.error || 'auth.errorSendCode');
  }
  return {
    ok: true,
    devCode: json.devCode,
    delivery: json.delivery === 'email' ? 'email' : json.devCode ? 'dev' : 'email',
  };
}

export async function postAuthVerifyCode(email: string, code: string): Promise<{ displayName: string }> {
  const res = await authFetch('/api/auth/verify-code', { email, code });
  const json = (await parseJson(res)) as Partial<{ displayName: string } & AuthErrorBody>;
  if (!res.ok) {
    throw new Error(json.error || 'auth.errorInvalidCode');
  }
  if (!json.displayName) {
    throw new Error('auth.errorInvalidCode');
  }
  return { displayName: json.displayName };
}
