/**
 * Haptics на iOS через TurboModule void methods.
 * Если native кидает NSException, RN 0.81.5 падает в
 * convertNSExceptionToJSError (Hermes heap) — известный баг.
 * Пока no-op на iOS; Android оставляем.
 */
import { Platform } from 'react-native';

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
type NotificationType = 'success' | 'warning' | 'error';

const noop = async () => {};

let ImpactFeedbackStyle: Record<string, ImpactStyle> = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
  Soft: 'soft',
  Rigid: 'rigid',
};

let NotificationFeedbackType: Record<string, NotificationType> = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
};

let selectionAsync = noop;
let impactAsync: (style?: ImpactStyle | string) => Promise<void> = noop;
let notificationAsync: (type?: NotificationType | string) => Promise<void> = noop;

if (Platform.OS !== 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Haptics = require('expo-haptics') as typeof import('expo-haptics');
    ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle as typeof ImpactFeedbackStyle;
    NotificationFeedbackType = Haptics.NotificationFeedbackType as typeof NotificationFeedbackType;
    selectionAsync = () => Haptics.selectionAsync();
    impactAsync = (style) => Haptics.impactAsync(style as never);
    notificationAsync = (type) => Haptics.notificationAsync(type as never);
  } catch {
    /* module missing — stay no-op */
  }
}

export { ImpactFeedbackStyle, NotificationFeedbackType, impactAsync, notificationAsync, selectionAsync };
