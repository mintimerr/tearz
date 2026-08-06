/**
 * Визуальный язык Tearz game-world (хаб / автомат / режимы).
 * Палитра: бело-синяя (Mario sky + paper white).
 */
export const GAME_THEME = {
  color: {
    sky: '#5C94FC',
    cream: '#FFFFFF',
    creamSoft: 'rgba(255,255,255,0.94)',
    ink: '#1A1A1A',
    /** Лицо кнопок / title bar — белое */
    gold: '#FFFFFF',
    /** Нижняя грань 3D-элементов — тёмно-синяя */
    goldLip: '#3A6BC8',
    void: '#1A1020',
    voidDeep: '#0B1430',
    phosphor: '#8AFFA8',
    phosphorDim: 'rgba(138, 255, 168, 0.5)',
    phosphorHot: '#C8FFD4',
    panelFill: '#FFFFFF',
    panelMuted: 'rgba(255,255,255,0.90)',
    /** Светло-голубая подложка карточек на sky-фоне */
    paper: '#F0F6FF',
    paperWarm: '#E8F2FF',
    danger: '#E85D4C',
    ok: '#30D158',
  },
  border: {
    thick: 3,
    thin: 2,
  },
  radius: {
    panel: 4,
    pill: 999,
    button: 12,
  },
  type: {
    title: 22,
    section: 15,
    body: 14,
    micro: 10,
    hud: 13,
  },
} as const;

export type GameTheme = typeof GAME_THEME;
