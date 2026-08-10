import type { CompanionChatApiLanguage, GeneratedCompanionProfile } from '@/types/companion-chat-api';

/** «О себе» в духе приложений знакомств — если API не вернул bio */
export function defaultStatusBio(lang: CompanionChatApiLanguage): string {
  if (lang === 'chinese') return '设计狗，靠咖啡续命。周末想出门但大概率躺平，随便聊聊也行。';
  if (lang === 'russian')
    return 'IT, кофе и сериалы до дыр. Ищу повод не смотреть в потолок по вечерам — напиши, если норм поболтать';
  if (lang === 'french')
    return 'Parisien, café trop cher, opinions sur le métro. Discutons si t’as cinq minutes.';
  if (lang === 'german')
    return 'Berliner Chaos, Kaffee und Bahn. Schreib, wenn du Bock auf Labern hast.';
  return 'Marketing by day, bad opinions about podcasts by night. Here for vibes and decent coffee.';
}

export function defaultOpeningForLang(lang: CompanionChatApiLanguage): string {
  if (lang === 'chinese') return '嗨，今天怎么样。有空的话聊聊。';
  if (lang === 'russian') return 'Привет. Как день. Если не занят — напиши пару строк.';
  if (lang === 'french') return 'Salut. Ça va ? Écris si tu as une minute.';
  if (lang === 'german') return 'Hey. Wie läuft’s? Schreib kurz, wenn du Zeit hast.';
  return 'Hey. How’s your day going.';
}

export function fallbackCompanionProfile(lang: CompanionChatApiLanguage): GeneratedCompanionProfile {
  if (lang === 'chinese') {
    return {
      name: '小林',
      age: 29,
      city: '上海',
      letter: '小',
      color: '#2C3A48',
      bio: '沪漂 / UX，咖啡因超标。喜欢瞎逛展和半夜听歌。聊天可以，别一上来查户口。',
      persona:
        'You are Xiao Lin: Shanghai, short lines, dry humor. Only really reads/writes Chinese in chat — English or Russian long messages confuse you; ask to rephrase in 中文. Not a tutor.',
      openingLine: '你好，今天怎么样。有空可以随便聊聊。',
    };
  }
  if (lang === 'russian') {
    return {
      name: 'Игорь',
      age: 31,
      city: 'Казань',
      letter: 'И',
      color: '#343D4A',
      bio: 'Инженер, по выходным либо зал либо ничего. Люблю плоский юмор и длинные разговоры про ерунду. Пиши нормально — отвечу',
      persona:
        'You are Igor from Kazan: dry humor, football, music. You only chat comfortably in Russian — long English etc. you don’t follow; ask them to say it in Russian. Never a tutor tone.',
      openingLine: 'Привет. Как день. Можем поболтать, если не лень.',
    };
  }
  return {
    name: 'Alex',
    age: 28,
    city: 'Manchester',
    letter: 'A',
    color: '#3A3A52',
    bio: '6’0 on a good posture day | grad school survivor | will trade memes for restaurant recs. Not here for small talk (lies, I am)',
    persona:
      'You are Alex from Manchester: sarcastic, casual English only. Russian or other languages in long form — you don’t get it; ask them to say it in English. Would never say “let’s practice”.',
    openingLine: 'Hey. Fancy a chat when you have a minute.',
  };
}
