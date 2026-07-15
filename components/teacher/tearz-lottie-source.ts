import type LottieView from 'lottie-react-native';
import type { ComponentProps } from 'react';

type LottieSource = ComponentProps<typeof LottieView>['source'];

/**
 * Точка подключения премиальной анимации Tearz (Lottie).
 *
 * Когда появится файл анимации:
 *   1) положи его в `assets/lottie/tearz.json`;
 *   2) замени строку ниже на:
 *        export const TEARZ_LOTTIE: LottieSource | null =
 *          require('../../assets/lottie/tearz.json');
 *
 * Пока здесь `null` — на главном экране автоматически работает встроенный
 * векторный риг (фоллбэк), приложение собирается и без ассета.
 */
export const TEARZ_LOTTIE: LottieSource | null = null;
