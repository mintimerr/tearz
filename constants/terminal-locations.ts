import type { ImageSource } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TerminalThemeId } from '@/constants/terminal-theme';

const TERMINAL_LAST_KEY = 'terminal-location-last';

/**
 * Полочка: в START только эти города. Данные остальных локаций не трогаем.
 * Вернуть все готовые экраны: поставь `null`.
 */
export const TERMINAL_SHELF_ONLY: TerminalLocationId[] | null = ['shanghai_metro_bund'];

/**
 * Локации «терминала» после START.
 * Каждый раз можно выпасть в другой world-object с вводом на его экране.
 */
export type TerminalLocationId =
  | 'asia_arcade'
  | 'europe_atm'
  | 'seoul_photo_booth'
  | 'paris_metro_guimard'
  | 'shanghai_metro_bund'
  | 'usa_bus_stop'
  | 'brazil_loterica'
  | 'japan_konbini'
  | 'uk_phone_box'
  | 'uae_metro';

/** Порядок чередования готовых локаций после START */
const READY_TERMINAL_ORDER: TerminalLocationId[] = [
  'uk_phone_box',
  'paris_metro_guimard',
  'shanghai_metro_bund',
  'asia_arcade',
  'europe_atm',
  'seoul_photo_booth',
];

export type TerminalNormRect = { left: number; top: number; width: number; height: number };

export type TerminalLocation = {
  id: TerminalLocationId;
  /** Короткое имя для дебага / аналитики */
  title: string;
  region: string;
  /** Что это за объект */
  object: string;
  /** Вайб / заметка для арта */
  vibe: string;
  /** Сцена готова к показу */
  ready: boolean;
  scene?: ImageSource;
  theme?: TerminalThemeId;
  /** Стекло экрана в долях сцены (0–1) */
  crt?: TerminalNormRect;
  focus?: TerminalNormRect;
  /** Тёплые пятна фонарей / неона для flicker */
  neon?: TerminalNormRect[];
  /** Жёлтые кнопки панели — пасхалка «прожал автомат» */
  buttons?: TerminalNormRect[];
  /** Спрайты кнопок (вырезаны из сцены); индекс = buttons[i] */
  buttonSprites?: ImageSource[];
  suggestions?: string[];
  /** Целевой язык урока с этой локации (L2). Родной — в профиле/UI. */
  lessonLanguage?: 'english' | 'chinese' | 'german' | 'french';
  phosphor?: string;
  /**
   * Смещение камеры в idle (доли ширины/высоты экрана).
   * Отрицательный panX = смотрим правее (виден фасад / граффити).
   */
  cameraIdle?: { panX?: number; panY?: number; scale?: number };
  /**
   * Как зумим при тапе по экрану.
   * `crt` — стекло на весь телефон (Seoul / Paris); `focus` — как аркада/Berlin.
   */
  zoomFill?: 'crt' | 'focus';
};

/** База без кнопок: лунки на панели. Кнопки — отдельные спрайты поверх. */
const ASIA_ARCADE_SCENE = require('../assets/images/tearz-mario/tearz-arcade-alley-scene-v2-nobtns.png');
const EUROPE_ATM_SCENE = require('../assets/images/tearz-mario/tearz-atm-mech-scene.png');
const SEOUL_PHOTO_BOOTH_SCENE = require('../assets/images/tearz-mario/tearz-seoul-photo-booth-scene.png');
const PARIS_METRO_SCENE = require('../assets/images/tearz-mario/tearz-paris-metro-scene.png');
const SHANGHAI_METRO_SCENE = require('../assets/images/tearz-mario/tearz-shanghai-metro-scene-level.png');
const LONDON_PHONE_BOX_SCENE = require('../assets/images/tearz-mario/tearz-london-phonebox-scene.png');

/**
 * Только хитбокс + текст внутри чёрного стекла.
 * Без зелёной заливки — иначе «торчит» поверх безеля.
 */
const ASIA_CRT = { left: 0.40039, top: 0.47461, width: 0.23145, height: 0.13216 };
const ASIA_FOCUS = { left: 0.34, top: 0.45, width: 0.34, height: 0.28 };
const ASIA_NEON: TerminalNormRect[] = [
  { left: 0.08, top: 0.18, width: 0.18, height: 0.14 },
  { left: 0.72, top: 0.12, width: 0.22, height: 0.16 },
  { left: 0.28, top: 0.08, width: 0.16, height: 0.1 },
  { left: 0.55, top: 0.22, width: 0.14, height: 0.12 },
];

/** 6 жёлтых кнопок: 2 ряда × 3 — координаты спрайтов из арта */
const ASIA_BUTTONS: TerminalNormRect[] = [
  { left: 0.5, top: 0.63737, width: 0.03125, height: 0.01367 },
  { left: 0.54297, top: 0.63932, width: 0.03125, height: 0.01367 },
  { left: 0.58496, top: 0.64062, width: 0.03027, height: 0.01432 },
  { left: 0.48828, top: 0.65299, width: 0.03027, height: 0.01562 },
  { left: 0.53125, top: 0.6543, width: 0.03125, height: 0.01562 },
  { left: 0.57324, top: 0.65625, width: 0.03125, height: 0.01562 },
];

const ASIA_BUTTON_SPRITES: ImageSource[] = [
  require('../assets/images/tearz-mario/tearz-arcade-btn-0.png'),
  require('../assets/images/tearz-mario/tearz-arcade-btn-1.png'),
  require('../assets/images/tearz-mario/tearz-arcade-btn-2.png'),
  require('../assets/images/tearz-mario/tearz-arcade-btn-3.png'),
  require('../assets/images/tearz-mario/tearz-arcade-btn-4.png'),
  require('../assets/images/tearz-mario/tearz-arcade-btn-5.png'),
];

/** LCD банкомата — Berlin U Kottbusser Tor (pixel art) */
const EUROPE_ATM_CRT = {
  left: 0.37598,
  top: 0.44922,
  width: 0.21289,
  height: 0.12174,
};
/**
 * Тот же размер focus, что у ASIA (→ одинаковый zoomScale),
 * центр смещён относительно LCD так же, как у японского CRT.
 */
const EUROPE_ATM_FOCUS = {
  left: 0.30631,
  top: 0.4194,
  width: 0.34,
  height: 0.28,
};
const EUROPE_ATM_SUN: TerminalNormRect[] = [
  { left: 0.62, top: 0.02, width: 0.28, height: 0.16 },
  { left: 0.08, top: 0.18, width: 0.18, height: 0.1 },
];

/** 12 цифр (3×4) + 3 action — вырезки из арта автомата, лунки в металле */
const EUROPE_ATM_KEYPAD: TerminalNormRect[] = [
  // row 1
  { left: 0.41210938, top: 0.61914062, width: 0.02148438, height: 0.00846354 },
  { left: 0.43457031, top: 0.61979167, width: 0.02148438, height: 0.00846354 },
  { left: 0.45507812, top: 0.62044271, width: 0.02148438, height: 0.00846354 },
  // row 2
  { left: 0.41015625, top: 0.62955729, width: 0.02246094, height: 0.00846354 },
  { left: 0.43261719, top: 0.63020833, width: 0.02246094, height: 0.00846354 },
  { left: 0.453125, top: 0.63085938, width: 0.02246094, height: 0.00846354 },
  // row 3
  { left: 0.40820312, top: 0.63997396, width: 0.02246094, height: 0.00846354 },
  { left: 0.43066406, top: 0.640625, width: 0.02246094, height: 0.00846354 },
  { left: 0.45117188, top: 0.64127604, width: 0.02246094, height: 0.00846354 },
  // row 4
  { left: 0.40625, top: 0.6484375, width: 0.0234375, height: 0.00846354 },
  { left: 0.4296875, top: 0.64908854, width: 0.0234375, height: 0.00846354 },
  { left: 0.44921875, top: 0.64973958, width: 0.0234375, height: 0.00846354 },
  // action column
  { left: 0.49609375, top: 0.62174479, width: 0.04101562, height: 0.00911458 },
  { left: 0.4921875, top: 0.6328125, width: 0.04199219, height: 0.00911458 },
  { left: 0.48828125, top: 0.64388021, width: 0.04296875, height: 0.00911458 },
];

const EUROPE_ATM_KEY_SPRITES: ImageSource[] = [
  require('../assets/images/tearz-mario/tearz-atm-btn-0.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-1.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-2.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-3.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-4.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-5.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-6.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-7.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-8.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-9.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-10.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-11.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-12.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-13.png'),
  require('../assets/images/tearz-mario/tearz-atm-btn-14.png'),
];

/**
 * LCD / экран 인생네컷-будки — Hongik-ro night.
 * Стекло ≈ 0.379×0.411 / 0.183×0.199; CRT чуть внутрь безеля.
 * FOCUS — средний план корпуса (не улица целиком, не «в упор» в LCD).
 */
const SEOUL_BOOTH_CRT = {
  left: 0.390,
  top: 0.424,
  width: 0.160,
  height: 0.174,
};
/** Будка + чуть неона по краям — удобный средний зум */
const SEOUL_BOOTH_FOCUS = {
  left: 0.335,
  top: 0.255,
  width: 0.315,
  height: 0.435,
};
const SEOUL_BOOTH_NEON: TerminalNormRect[] = [
  { left: 0.62, top: 0.12, width: 0.2, height: 0.18 },
  { left: 0.72, top: 0.28, width: 0.16, height: 0.14 },
  { left: 0.08, top: 0.2, width: 0.14, height: 0.12 },
];

/** LCD автомата Navigo · Quai de Grenelle / Bir-Hakeim — inset внутри безеля */
const PARIS_METRO_CRT = {
  left: 0.3535,
  top: 0.418,
  width: 0.3223,
  height: 0.1764,
};
const PARIS_METRO_FOCUS = {
  left: 0.33,
  top: 0.395,
  width: 0.37,
  height: 0.225,
};
const PARIS_METRO_NEON: TerminalNormRect[] = [
  { left: 0.55, top: 0.08, width: 0.28, height: 0.16 },
  { left: 0.08, top: 0.12, width: 0.2, height: 0.14 },
  { left: 0.7, top: 0.32, width: 0.18, height: 0.12 },
];

/**
 * LCD Shanghai — арт выровнен (scene-level.png, +3.5°), UI без skew/rotate.
 * Стекло ≈ 0.349×0.453 / 0.292×0.154; CRT inset внутрь безеля.
 */
const SHANGHAI_METRO_CRT = {
  left: 0.361,
  top: 0.463,
  width: 0.268,
  height: 0.134,
};
const SHANGHAI_METRO_FOCUS = {
  left: 0.335,
  top: 0.438,
  width: 0.32,
  height: 0.18,
};
const SHANGHAI_METRO_NEON: TerminalNormRect[] = [
  { left: 0.55, top: 0.06, width: 0.3, height: 0.16 },
  { left: 0.08, top: 0.1, width: 0.2, height: 0.14 },
  { left: 0.72, top: 0.28, width: 0.16, height: 0.12 },
];

/** LCD payphone — только чёрное стекло (не безель и не металл над экраном). */
const LONDON_PHONE_CRT = {
  left: 0.488,
  top: 0.408,
  width: 0.098,
  height: 0.045,
};
/** Зум: сам телефонный аппарат в открытой двери + чуть красной рамы */
const LONDON_PHONE_FOCUS = {
  left: 0.40,
  top: 0.28,
  width: 0.30,
  height: 0.46,
};
const LONDON_PHONE_NEON: TerminalNormRect[] = [
  { left: 0.08, top: 0.1, width: 0.22, height: 0.18 },
  { left: 0.7, top: 0.14, width: 0.2, height: 0.14 },
  { left: 0.55, top: 0.3, width: 0.16, height: 0.1 },
];

export const TERMINAL_LOCATIONS: TerminalLocation[] = [
  {
    id: 'asia_arcade',
    title: 'Yokocho Arcade',
    region: 'Asia · Japan',
    object: 'Подпольный candy-cab в переулке',
    vibe: 'Фонари, ゲームや, мокрый асфальт, винтажный автомат',
    ready: true,
    theme: 'crt',
    scene: ASIA_ARCADE_SCENE,
    crt: ASIA_CRT,
    focus: ASIA_FOCUS,
    neon: ASIA_NEON,
    buttons: ASIA_BUTTONS,
    buttonSprites: ASIA_BUTTON_SPRITES,
    suggestions: ['Airport English', '点餐 · еда', '旅行の会話'],
    lessonLanguage: 'english',
    phosphor: 'transparent',
  },
  {
    id: 'europe_atm',
    title: 'Kottbusser Tor ATM',
    region: 'Europe · Berlin',
    object: 'Geldautomat у входа в U-Bahn',
    vibe: 'Pixel-art дневной U Kottbusser Tor, Geldautomat, tearz-graffiti, наш маскот на постере',
    ready: true,
    theme: 'lcd',
    scene: EUROPE_ATM_SCENE,
    crt: EUROPE_ATM_CRT,
    focus: EUROPE_ATM_FOCUS,
    neon: EUROPE_ATM_SUN,
    buttons: EUROPE_ATM_KEYPAD,
    buttonSprites: EUROPE_ATM_KEY_SPRITES,
    suggestions: ['PIN eingeben', 'Geld abheben', 'English'],
    lessonLanguage: 'german',
    phosphor: 'transparent',
    // Без letterbox-рамок: полный cover + лёгкий сдвиг вправо к фасаду/tearz
    cameraIdle: { panX: -0.08, scale: 1 },
  },
  {
    id: 'seoul_photo_booth',
    title: 'Hongik-ro Photo Booth',
    region: 'Asia · Seoul',
    object: 'Уличная 인생네컷-фотобудка',
    vibe: 'Hongdae night, Tearz на корпусе, столб в наклейках, Namsan',
    ready: true,
    theme: 'booth',
    scene: SEOUL_PHOTO_BOOTH_SCENE,
    crt: SEOUL_BOOTH_CRT,
    focus: SEOUL_BOOTH_FOCUS,
    neon: SEOUL_BOOTH_NEON,
    suggestions: [],
    /** Пока в API нет korean — tourist English; Hangul в саджестах задаёт вайб. */
    lessonLanguage: 'english',
    phosphor: 'transparent',
    /** LCD на весь safe-area; при клавиатуре — над ней, чтобы «+» был виден */
    zoomFill: 'crt',
    cameraIdle: { panX: 0.02, scale: 1.05 },
  },
  {
    id: 'paris_metro_guimard',
    title: 'Bir-Hakeim Navigo',
    region: 'Europe · Paris',
    object: 'Автомат Navigo на Quai de Grenelle',
    vibe: 'День, линия 6, Tour Eiffel, Tearz-стикеры, transit UI',
    ready: true,
    theme: 'metro',
    scene: PARIS_METRO_SCENE,
    crt: PARIS_METRO_CRT,
    focus: PARIS_METRO_FOCUS,
    neon: PARIS_METRO_NEON,
    suggestions: ['Billet t+', 'Navigo', 'Où est…?'],
    lessonLanguage: 'french',
    phosphor: 'transparent',
    zoomFill: 'crt',
    cameraIdle: { panX: 0, scale: 1 },
  },
  {
    id: 'shanghai_metro_bund',
    title: 'East Nanjing Rd Ticket',
    region: 'Asia · Shanghai',
    object: 'Автомат 上海地铁 на Bund / Nanjing Rd (E)',
    vibe: 'День, Oriental Pearl, Tearz на боковине, transit LCD',
    ready: true,
    theme: 'shanghai',
    scene: SHANGHAI_METRO_SCENE,
    crt: SHANGHAI_METRO_CRT,
    focus: SHANGHAI_METRO_FOCUS,
    neon: SHANGHAI_METRO_NEON,
    suggestions: [],
    lessonLanguage: 'chinese',
    phosphor: 'transparent',
    zoomFill: 'crt',
    cameraIdle: { panX: 0, scale: 1 },
  },
  {
    id: 'usa_bus_stop',
    title: 'Bus Stop Board',
    region: 'USA · LA / Chicago',
    object: 'Инфотабло на автобусной остановке',
    vibe: 'Ночь, neon diner рядом, расписание рейсов как меню уроков',
    /** v1 soft launch: не в ротации START (arcade → atm → seoul → paris). */
    ready: false,
  },
  {
    id: 'brazil_loterica',
    title: 'Lotérica Terminal',
    region: 'Brazil · São Paulo',
    object: 'Терминал лотереи / оплаты',
    vibe: 'Жёлто-зелёный пластик, очередь, уличный шум',
    ready: false,
  },
  {
    id: 'japan_konbini',
    title: 'Konbini Register',
    region: 'Asia · Tokyo',
    object: 'Касса / self-checkout в конбини',
    vibe: 'Яркий интерьер 7-eleven-like, бип сканера, ночная смена',
    ready: false,
  },
  {
    id: 'uk_phone_box',
    title: 'Parliament Street Box',
    region: 'UK · London',
    object: 'Красная телефонная будка с LCD внутри',
    vibe: 'День, Westminster, Big Ben, tearz на короне, мокрый асфальт',
    ready: true,
    theme: 'callbox',
    scene: LONDON_PHONE_BOX_SCENE,
    crt: LONDON_PHONE_CRT,
    focus: LONDON_PHONE_FOCUS,
    neon: LONDON_PHONE_NEON,
    suggestions: ['Oyster', 'Tube map', 'Where is…?'],
    lessonLanguage: 'english',
    phosphor: 'transparent',
    /**
     * crt по увеличенной панели аппарата: читаемый UI на лицевой стороне,
     * зум сильнее «среднего плана будки», но не в упор в 5%-LCD.
     */
    zoomFill: 'crt',
    cameraIdle: { panX: -0.03, scale: 1.06 },
  },
  {
    id: 'uae_metro',
    title: 'Metro Ticket Kiosk',
    region: 'UAE · Dubai',
    object: 'Автомат билетов в метро',
    vibe: 'Стекло, кондиционер, карта линий как дерево уроков',
    ready: false,
  },
];

export function getTerminalLocation(id: TerminalLocationId): TerminalLocation {
  const loc = TERMINAL_LOCATIONS.find((l) => l.id === id) ?? TERMINAL_LOCATIONS[0];
  const shelf = TERMINAL_SHELF_ONLY;
  if (shelf?.length && !shelf.includes(loc.id)) {
    return TERMINAL_LOCATIONS.find((l) => l.id === shelf[0]) ?? loc;
  }
  return loc;
}

function rotationOrder(readyOnly: boolean): TerminalLocationId[] {
  const shelf = TERMINAL_SHELF_ONLY;
  const base = shelf ?? READY_TERMINAL_ORDER;
  return base.filter((id) => {
    const loc = TERMINAL_LOCATIONS.find((l) => l.id === id);
    return loc != null && (!readyOnly || loc.ready);
  });
}

/** Следующая готовая локация — строго по кругу (arcade → atm → seoul → paris → …). */
export async function pickTerminalLocation(readyOnly = true): Promise<TerminalLocation> {
  const order = rotationOrder(readyOnly);

  if (order.length <= 1) {
    return getTerminalLocation(order[0] ?? 'shanghai_metro_bund');
  }

  const last = (await AsyncStorage.getItem(TERMINAL_LAST_KEY)) as TerminalLocationId | null;
  const lastIdx = last ? order.indexOf(last) : -1;
  const nextId = order[(lastIdx + 1) % order.length];
  await AsyncStorage.setItem(TERMINAL_LAST_KEY, nextId);
  return getTerminalLocation(nextId);
}
