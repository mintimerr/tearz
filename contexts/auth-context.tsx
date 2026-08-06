import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DEMO_SKIP_AUTH } from '@/constants/demo';
import { LOCALE_STORAGE_KEY, PENDING_SIGNUP_KEY } from '@/constants/locale-storage';
import { postAuthSendCode, postAuthVerifyCode } from '@/services/auth-api';
import {
  clearLegacyGlobalData,
  initEmptyUserData,
  loadAccountsRegistry,
  migrateLegacyDataToUser,
  saveAccountsRegistry,
  type AccountsRegistry,
} from '@/utils/user-data-storage';

const SESSION_KEY = '@tearz/auth_session';
const ACTIVE_USER_KEY = '@tearz/auth_active_user';

const DEMO_EMAIL = 'demo@tearz.app';
const DEMO_PASSWORD = 'demo-tearz';

export type NativeLanguage = 'ru' | 'zh' | 'en';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  nativeLanguage: NativeLanguage;
  createdAt: number;
};

export type PendingSignUp = {
  email: string;
  password: string;
  displayName: string;
  nativeLanguage: NativeLanguage;
  createdAt: number;
};

type AuthContextValue = {
  isHydrated: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  requestSignUpCode: (params: {
    email: string;
    password: string;
    displayName: string;
    nativeLanguage: NativeLanguage;
  }) => Promise<{ ok: boolean; error?: string; devCode?: string; delivery?: 'dev' | 'email' }>;
  completeSignUpWithCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
  resendSignUpCode: () => Promise<{ ok: boolean; error?: string; devCode?: string; delivery?: 'dev' | 'email' }>;
  signOut: () => Promise<void>;
  updateNativeLanguage: (nativeLanguage: NativeLanguage) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function userIdFromEmail(email: string) {
  return `user-${email.replace(/[^a-z0-9]/g, '').slice(0, 24)}`;
}

async function persistSession(user: AuthUser) {
  await AsyncStorage.multiSet([
    [SESSION_KEY, '1'],
    [ACTIVE_USER_KEY, JSON.stringify(user)],
    [LOCALE_STORAGE_KEY, user.nativeLanguage],
  ]);
}

async function clearSession() {
  await AsyncStorage.multiRemove([SESSION_KEY, ACTIVE_USER_KEY]);
}

async function ensureDemoUser(): Promise<AuthUser> {
  const registry = await loadAccountsRegistry();
  const existing = registry[DEMO_EMAIL];
  if (existing?.user) {
    const authUser: AuthUser = {
      ...existing.user,
      nativeLanguage: existing.user.nativeLanguage ?? 'ru',
    };
    await migrateLegacyDataToUser(authUser.id);
    await persistSession(authUser);
    return authUser;
  }

  const authUser: AuthUser = {
    id: userIdFromEmail(DEMO_EMAIL),
    email: DEMO_EMAIL,
    displayName: 'Demo',
    nativeLanguage: 'ru',
    createdAt: Date.now(),
  };
  const nextRegistry: AccountsRegistry = {
    ...registry,
    [DEMO_EMAIL]: { user: authUser, password: DEMO_PASSWORD },
  };
  await saveAccountsRegistry(nextRegistry);
  await initEmptyUserData(authUser.id);
  await migrateLegacyDataToUser(authUser.id);
  await persistSession(authUser);
  return authUser;
}

async function updateAccountUser(user: AuthUser, password?: string) {
  const registry = await loadAccountsRegistry();
  const existing = registry[user.email];
  if (!existing) return;
  registry[user.email] = {
    user,
    password: password ?? existing.password,
  };
  await saveAccountsRegistry(registry);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await AsyncStorage.getItem(SESSION_KEY);
        if (cancelled) return;
        if (session === '1') {
          const rawUser = await AsyncStorage.getItem(ACTIVE_USER_KEY);
          if (rawUser) {
            try {
              const parsed = JSON.parse(rawUser) as AuthUser;
              setUser({
                ...parsed,
                nativeLanguage: parsed.nativeLanguage ?? 'ru',
              });
              return;
            } catch {
              await clearSession();
            }
          }
        }
        if (DEMO_SKIP_AUTH) {
          const demoUser = await ensureDemoUser();
          if (!cancelled) setUser(demoUser);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes('@')) {
      return { ok: false, error: 'auth.errorEmail' };
    }
    if (password.length < 6) {
      return { ok: false, error: 'auth.errorPassword' };
    }

    const registry = await loadAccountsRegistry();
    const account = registry[normalized];
    if (!account) {
      return { ok: false, error: 'auth.errorNoAccount' };
    }
    if (account.password !== password) {
      return { ok: false, error: 'auth.errorWrongPassword' };
    }

    const authUser: AuthUser = {
      ...account.user,
      nativeLanguage: account.user.nativeLanguage ?? 'ru',
    };

    await migrateLegacyDataToUser(authUser.id);
    await persistSession(authUser);
    setUser(authUser);
    return { ok: true };
  }, []);

  const createAccount = useCallback(async (pending: PendingSignUp) => {
    const normalized = normalizeEmail(pending.email);
    const registry = await loadAccountsRegistry();
    if (registry[normalized]) {
      return { ok: false as const, error: 'auth.errorEmailTaken' };
    }

    const authUser: AuthUser = {
      id: userIdFromEmail(normalized),
      email: normalized,
      displayName: pending.displayName.trim(),
      nativeLanguage: pending.nativeLanguage,
      createdAt: Date.now(),
    };

    const nextRegistry: AccountsRegistry = {
      ...registry,
      [normalized]: { user: authUser, password: pending.password },
    };

    await saveAccountsRegistry(nextRegistry);
    await initEmptyUserData(authUser.id);
    await clearLegacyGlobalData();
    await AsyncStorage.removeItem(PENDING_SIGNUP_KEY);
    await persistSession(authUser);
    setUser(authUser);
    return { ok: true as const };
  }, []);

  const requestSignUpCode = useCallback(
    async (params: {
      email: string;
      password: string;
      displayName: string;
      nativeLanguage: NativeLanguage;
    }) => {
      const normalized = normalizeEmail(params.email);
      if (!normalized || !normalized.includes('@')) {
        return { ok: false, error: 'auth.errorEmail' };
      }
      if (params.password.length < 6) {
        return { ok: false, error: 'auth.errorPassword' };
      }
      if (!params.displayName.trim()) {
        return { ok: false, error: 'auth.errorName' };
      }

      const registry = await loadAccountsRegistry();
      if (registry[normalized]) {
        return { ok: false, error: 'auth.errorEmailTaken' };
      }

      const pending: PendingSignUp = {
        email: normalized,
        password: params.password,
        displayName: params.displayName.trim(),
        nativeLanguage: params.nativeLanguage,
        createdAt: Date.now(),
      };

      try {
        const sent = await postAuthSendCode(normalized, {
          displayName: pending.displayName,
          purpose: 'signUp',
        });
        await AsyncStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(pending));
        return { ok: true, devCode: sent.devCode, delivery: sent.delivery };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'auth.errorSendCode';
        return { ok: false, error: msg.startsWith('auth.') ? msg : 'auth.errorSendCode' };
      }
    },
    [],
  );

  const loadPendingSignUp = useCallback(async (): Promise<PendingSignUp | null> => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_SIGNUP_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PendingSignUp;
      if (!parsed?.email || !parsed.password) return null;
      const age = Date.now() - (parsed.createdAt ?? 0);
      if (age > 15 * 60 * 1000) {
        await AsyncStorage.removeItem(PENDING_SIGNUP_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const completeSignUpWithCode = useCallback(
    async (code: string) => {
      const pending = await loadPendingSignUp();
      if (!pending) {
        return { ok: false, error: 'auth.errorPendingSignup' };
      }

      const trimmed = code.replace(/\D/g, '');
      if (trimmed.length !== 6) {
        return { ok: false, error: 'auth.errorInvalidCode' };
      }

      try {
        await postAuthVerifyCode(pending.email, trimmed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'auth.errorInvalidCode';
        return { ok: false, error: msg.startsWith('auth.') ? msg : 'auth.errorInvalidCode' };
      }

      return createAccount(pending);
    },
    [createAccount, loadPendingSignUp],
  );

  const resendSignUpCode = useCallback(async () => {
    const pending = await loadPendingSignUp();
    if (!pending) {
      return { ok: false, error: 'auth.errorPendingSignup' };
    }
    try {
      const sent = await postAuthSendCode(pending.email, {
        displayName: pending.displayName,
        purpose: 'signUp',
      });
      return { ok: true, devCode: sent.devCode, delivery: sent.delivery };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'auth.errorSendCode';
      return { ok: false, error: msg.startsWith('auth.') ? msg : 'auth.errorSendCode' };
    }
  }, [loadPendingSignUp]);

  const signOut = useCallback(async () => {
    if (DEMO_SKIP_AUTH) {
      const demoUser = await ensureDemoUser();
      setUser(demoUser);
      return;
    }
    await clearSession();
    setUser(null);
  }, []);

  const updateNativeLanguage = useCallback(
    async (nativeLanguage: NativeLanguage) => {
      if (!user) return;
      const next = { ...user, nativeLanguage };
      await updateAccountUser(next);
      await persistSession(next);
      setUser(next);
    },
    [user],
  );

  const value = useMemo(
    () => ({
      isHydrated,
      isAuthenticated: !!user,
      user,
      signIn,
      requestSignUpCode,
      completeSignUpWithCode,
      resendSignUpCode,
      signOut,
      updateNativeLanguage,
    }),
    [
      isHydrated,
      user,
      signIn,
      requestSignUpCode,
      completeSignUpWithCode,
      resendSignUpCode,
      signOut,
      updateNativeLanguage,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
