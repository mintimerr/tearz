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
      title: 'Минута в чате?',
      body: 'Прошло 24 часа с последнего сообщения — напиши одно, собеседник ждёт.',
    },
    en: {
      title: 'Quick reply?',
      body: "24 hours since your last message — drop one line in the chat.",
    },
    zh: {
      title: '回一句？',
      body: '距上次发消息已经24小时了，来聊一句吧。',
    },
  },
  final: {
    ru: {
      title: 'Больше не будем слать',
      body: 'Нам кажется, пора перестать присылать уведомления — они не работают.',
    },
    en: {
      title: "We'll stop notifying you",
      body: "We think it's time to stop sending notifications — they clearly aren't working.",
    },
    zh: {
      title: '我们不再提醒了',
      body: '看来通知对你没用——我们不再发送了。',
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
