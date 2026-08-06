export type TerminalThemeId = 'crt' | 'lcd';

export type TerminalThemeConfig = {
  id: TerminalThemeId;
  rootBg: string;
  fg: string;
  dim: string;
  hot: string;
  /** Подложка стекла экрана */
  screenBg: string;
  idleLabel: string;
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
    chromeDark: true,
  },
  lcd: {
    id: 'lcd',
    rootBg: '#D4E8F8',
    fg: '#E8EEF5',
    dim: 'rgba(232, 238, 245, 0.45)',
    hot: '#8EC5F0',
    screenBg: 'transparent',
    idleLabel: 'TIPPEN',
    chromeDark: false,
  },
};

export function getTerminalTheme(id?: TerminalThemeId): TerminalThemeConfig {
  return TERMINAL_THEMES[id ?? 'crt'];
}
