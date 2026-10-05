import AsyncStorage from '@react-native-async-storage/async-storage';

import { userDataKey, USER_SUFFIX } from '@/utils/user-data-storage';

export type OnboardingTipId =
  | 'ink'
  | 'welcome'
  | 'hub'
  | 'arcade'
  | 'cards'
  | 'dialogs'
  | 'profile'
  | 'spotHub'
  | 'spotCards'
  | 'spotDialogs'
  | 'spotArcade'
  | 'spotAsk'
  | 'spotWords'
  | 'spotTrain'
  | 'coachHub'
  | 'coachHub2'
  | 'coachHub3'
  | 'coachHub4'
  | 'coachHub5'
  | 'coachHub6'
  | 'coachHub7'
  | 'coachHub8'
  | 'coachHub9'
  | 'coachCards'
  | 'coachCards2'
  | 'coachDialogs'
  | 'coachDialogs2'
  | 'coachDialogs3'
  | 'coachDialogs4'
  | 'coachDialogs5'
  | 'coachArcade'
  | 'coachArcade2'
  | 'coachArcade3'
  | 'coachArcade4'
  | 'coachArcade5'
  | 'coachArcade6'
  | 'coachArcade7'
  | 'coachArcade8'
  | 'coachAsk'
  | 'coachAsk2'
  | 'coachAsk3'
  | 'coachWords'
  | 'coachWords2'
  | 'coachTrain'
  | 'coachTrain2'
  | 'coachTrain3';

export type OnboardingTipsState = Partial<Record<OnboardingTipId, boolean>>;

export async function loadOnboardingTips(userId: string): Promise<OnboardingTipsState> {
  try {
    const raw = await AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.onboardingTips));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as OnboardingTipsState;
  } catch {
    return {};
  }
}

export async function saveOnboardingTips(userId: string, state: OnboardingTipsState) {
  await AsyncStorage.setItem(userDataKey(userId, USER_SUFFIX.onboardingTips), JSON.stringify(state));
}

export async function markOnboardingTipSeen(userId: string, tipId: OnboardingTipId) {
  const prev = await loadOnboardingTips(userId);
  if (prev[tipId]) return prev;
  const next = { ...prev, [tipId]: true };
  await saveOnboardingTips(userId, next);
  return next;
}
