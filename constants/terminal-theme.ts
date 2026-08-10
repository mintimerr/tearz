export type TerminalThemeId = 'crt' | 'lcd' | 'booth' | 'metro' | 'shanghai' | 'callbox';

export type TerminalThemeConfig = {
  id: TerminalThemeId;
  rootBg: string;
  fg: string;
  dim: string;
  hot: string;
  /** Подложка стекла экрана */
  screenBg: string;
  idleLabel: string;
  /** Подсказка до ввода */
  startHint: string;
  /** Префикс строки ввода */
  prompt: string;
  selection: string;
  /** CRT-сканлайны (только аркада) */
  scanlines: boolean;
  /** Тёмные кнопки chrome (назад / чаты) */
  chromeDark: boolean;
};

export const TERMINAL_THEMES: Record<TerminalThemeId, TerminalThemeConfig> = {
  crt: {
    id: 'crt',
    rootBg: '#1A1020',
    fg: '#8AFFA8',
    dim: 'rgba(138, 255, 168, 0.5)',
    hot: '#C8FFD4',
    screenBg: 'transparent',
    idleLabel: 'TAP',
    startHint: 'TAP TO START',
    prompt: '>',
    selection: 'rgba(138, 255, 168, 0.35)',
    scanlines: true,
    chromeDark: true,
  },
  lcd: {
    id: 'lcd',
    rootBg: '#D4E8F8',
    fg: '#E8EEF5',
    dim: 'rgba(232, 238, 245, 0.45)',
    hot: '#8EC5F0',
    screenBg: 'transparent',
    idleLabel: 'TAP',
    /** Универсально — не все читают Deutsch */
    startHint: 'TAP TO START',
    prompt: '>',
    selection: 'rgba(142, 197, 240, 0.35)',
    scanlines: false,
    chromeDark: false,
  },
  /** Seoul 인생네컷 — мягкий kiosk UI, не аркадный CRT */
  booth: {
    id: 'booth',
    rootBg: '#1A1028',
    fg: '#FFF0F8',
    dim: 'rgba(255, 190, 220, 0.5)',
    hot: '#FF6EC7',
    screenBg: 'transparent',
    idleLabel: 'TAP',
    /** Универсально — не все читают 한국어 */
    startHint: 'TAP TO START',
    prompt: '♡',
    selection: 'rgba(255, 110, 199, 0.4)',
    scanlines: false,
    chromeDark: true,
  },
  /** Paris Bir-Hakeim / Navigo automate — спокойный premium transit UI */
  metro: {
    id: 'metro',
    rootBg: '#07101F',
    fg: '#F2F4F8',
    dim: 'rgba(196, 205, 220, 0.42)',
    /** Navigo / RATP violet-blue, не неон */
    hot: '#9AA8D4',
    screenBg: 'transparent',
    idleLabel: 'TOUCH',
    startHint: 'TOUCH TO BEGIN',
    prompt: '›',
    selection: 'rgba(117, 73, 150, 0.35)',
    scanlines: false,
    chromeDark: true,
  },
  /** Shanghai Metro ticket / 交通卡充值 — красный metro + холодный LCD */
  shanghai: {
    id: 'shanghai',
    rootBg: '#0A121C',
    fg: '#F5F7FA',
    dim: 'rgba(190, 205, 220, 0.45)',
    /** Shanghai Metro red */
    hot: '#E31C23',
    screenBg: 'transparent',
    idleLabel: 'TAP',
    startHint: 'TAP TO START',
    prompt: '›',
    selection: 'rgba(227, 28, 35, 0.32)',
    scanlines: false,
    chromeDark: true,
  },
  /** London red phone box — компактный BT/payphone LCD */
  callbox: {
    id: 'callbox',
    rootBg: '#1A0A0C',
    fg: '#F3EDE8',
    dim: 'rgba(220, 200, 190, 0.42)',
    hot: '#E8A09A',
    screenBg: 'transparent',
    idleLabel: 'TAP',
    startHint: 'TAP TO START',
    prompt: '›',
    selection: 'rgba(200, 80, 70, 0.35)',
    scanlines: false,
    chromeDark: true,
  },
};

export function getTerminalTheme(id?: TerminalThemeId): TerminalThemeConfig {
  return TERMINAL_THEMES[id ?? 'crt'];
}
