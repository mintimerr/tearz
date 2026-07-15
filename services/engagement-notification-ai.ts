import type { NativeLanguage } from '@/contexts/auth-context';

export type EngagementNotificationKind = 'reengagement' | 'final';

export type EngagementNotificationCopy = {
  title: string;
  body: string;
};

function mapLanguage(language: NativeLanguage): 'russian' | 'english' | 'chinese' {
  if (language === 'en') return 'english';
  if (language === 'zh') return 'chinese';
  return 'russian';
}

import { companionApiRequestHeaders, getCompanionChatApiBaseUrl } from '@/utils/companion-api-config';

const FALLBACK: Record<EngagementNotificationKind, Record<NativeLanguage, EngagementNotificationCopy>> = {
  reengagement: {
    ru: {
      title: 'Минута практики?',
      body: 'Прошло 24 часа — собеседник ждёт короткое сообщение от тебя.',
    },
    en: {
      title: 'Quick practice?',
      body: '24 hours since your last message — drop in for a minute.',
    },
    zh: {
      title: '练一下？',
      body: '距上次发消息已经24小时了，来聊一句吧。',
    },
  },
  final: {
    ru: {
      title: 'Больше не будем напоминать',
      body: 'Похоже, уведомления не работают — мы перестанем их слать. Вернёшься, когда будет удобно.',
    },
    en: {
      title: "We'll stop reminding you",
      body: "Looks like notifications aren't working — we won't send more. Come back whenever you're ready.",
    },
    zh: {
      title: '我们不再提醒了',
      body: '看起来通知对你没用——之后不会再发。想练的时候随时回来。',
    },
  },
};

export function fallbackNotificationCopy(
  kind: EngagementNotificationKind,
  language: NativeLanguage,
): EngagementNotificationCopy {
  return FALLBACK[kind][language] ?? FALLBACK[kind].ru;
}

export async function fetchEngagementNotificationCopy(params: {
  kind: EngagementNotificationKind;
  language: NativeLanguage;
  streakDays: number;
  lastMessagePreview?: string;
  chatName?: string;
  lessonTopic?: string;
}): Promise<EngagementNotificationCopy> {
  let base = '';
  try {
    base = getCompanionChatApiBaseUrl();
  } catch {
    return fallbackNotificationCopy(params.kind, params.language);
  }
  if (!base) {
    return fallbackNotificationCopy(params.kind, params.language);
  }

  try {
    const res = await fetch(`${base}/api/engagement-notification`, {
      method: 'POST',
      headers: companionApiRequestHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...params, language: mapLanguage(params.language) }),
    });
    const raw = await res.text();
    let json: unknown;
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      return fallbackNotificationCopy(params.kind, params.language);
    }
    if (!res.ok) {
      return fallbackNotificationCopy(params.kind, params.language);
    }
    const ok = json as { title?: unknown; body?: unknown };
    const title = typeof ok.title === 'string' ? ok.title.trim().slice(0, 80) : '';
    const body = typeof ok.body === 'string' ? ok.body.trim().slice(0, 180) : '';
    if (!title || !body) {
      return fallbackNotificationCopy(params.kind, params.language);
    }
    return { title, body };
  } catch {
    return fallbackNotificationCopy(params.kind, params.language);
  }
}
