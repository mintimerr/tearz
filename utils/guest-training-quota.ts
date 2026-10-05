import AsyncStorage from '@react-native-async-storage/async-storage';

/** Сколько тренировок гость проходит до просьбы зарегистрироваться. */
export const GUEST_FREE_TRAININGS = 5;

const KEY = '@tearz/guest-trainings-completed';

export async function loadGuestTrainingsDone(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** +1 после полностью пройденной тренировки. Счётчик на устройстве, не на аккаунте. */
export async function recordGuestTrainingDone(): Promise<number> {
  const next = (await loadGuestTrainingsDone()) + 1;
  await AsyncStorage.setItem(KEY, String(next));
  return next;
}
