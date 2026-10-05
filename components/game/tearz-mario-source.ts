import type { ImageSource } from 'expo-image';

/**
 * Tearz только в Mario / SNES pixel-графике.
 * Фото/Kling 3D сюда не подключать.
 */
export const TEARZ_MARIO = {
  idle: require('../../assets/images/tearz-mario/tearz-mario-idle-sprite.png') as ImageSource,
  book: require('../../assets/images/tearz-mario/tearz-mario-book-sprite.png') as ImageSource,
  phone: require('../../assets/images/tearz-mario/tearz-mario-phone-sprite.png') as ImageSource,
  /** Поза «в метро с телефоном» — экран генерации упражнений */
  phoneMetro: require('../../assets/images/tearz-mario/tearz-mario-phone-metro-cut.png') as ImageSource,
  build: require('../../assets/images/tearz-mario/tearz-mario-build-sprite.png') as ImageSource,
  jump: require('../../assets/images/tearz-mario/tearz-mario-jump-sprite.png') as ImageSource,
  run: require('../../assets/images/tearz-mario/tearz-mario-run-sprite.png') as ImageSource,
  fly: require('../../assets/images/tearz-mario/tearz-mario-fly-sprite.png') as ImageSource,
  talk: require('../../assets/images/tearz-mario/tearz-mario-talk-sprite.png') as ImageSource,
  /** Онбординг: красная мантия и красная шапка, объясняет */
  coach: require('../../assets/images/tearz-mario/tearz-onboard-coach.png') as ImageSource,
  /** Онбординг собеседника: читает книгу, вторая рука на боку */
  coachRead: require('../../assets/images/tearz-mario/tearz-onboard-read.png') as ImageSource,
  /** Празднует завершение placement-теста (ref: tearz-placement-celebrate-ref.png) */
  celebrate: require('../../assets/images/tearz-mario/tearz-placement-celebrate-sprite.png') as ImageSource,
  /** Путь после теста — Tearz с ноутбуком на коленях (ref: tearz-path-laptop-lap-ref.png) */
  pathLaptop: require('../../assets/images/tearz-mario/tearz-path-laptop-lap-sprite.png') as ImageSource,
  /** Онбординг после теста — указывает на пользователя (ref: tearz-point-at-you-ref.png) */
  pointAtYou: require('../../assets/images/tearz-mario/tearz-point-at-you-sprite.png') as ImageSource,
  /** Первый заход — праздничная поза без шахматки и конфетти */
  welcome: require('../../assets/images/tearz-mario/tearz-welcome-sprite.png') as ImageSource,
  cityBgDay: require('../../assets/images/tearz-mario/tearz-mario-city-world.jpg') as ImageSource,
  cityBgNight: require('../../assets/images/tearz-mario/tearz-mario-city-world-night.png') as ImageSource,
} as const;

export type TearzMarioPose = Exclude<
  keyof typeof TEARZ_MARIO,
  'cityBgDay' | 'cityBgNight' | 'phoneMetro' | 'celebrate' | 'pathLaptop' | 'pointAtYou' | 'welcome' | 'coach' | 'coachRead'
>;

/** Вечер/ночь по локальному времени устройства: 19:00–06:59. */
export function isHubNightNow(now = new Date()): boolean {
  const hour = now.getHours();
  return hour >= 19 || hour < 7;
}

export const TEARZ_MARIO_ATTRACT = [
  TEARZ_MARIO.idle,
  TEARZ_MARIO.book,
  TEARZ_MARIO.phone,
  TEARZ_MARIO.build,
  TEARZ_MARIO.jump,
  TEARZ_MARIO.run,
  TEARZ_MARIO.fly,
  TEARZ_MARIO.talk,
] as const;
