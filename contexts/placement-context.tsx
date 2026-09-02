import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { DEMO_SKIP_AUTH } from '@/constants/demo';
import { useAuth } from '@/contexts/auth-context';
import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type { PlacementRecord } from '@/types/placement-api';
import { userDataKey, USER_SUFFIX } from '@/utils/user-data-storage';

const DEMO_PLACEMENT_KEY = '@tearz/demo/placement.v1';

type PlacementContextValue = {
  hydrated: boolean;
  record: PlacementRecord | null;
  isComplete: boolean;
  savePlacement: (record: PlacementRecord) => Promise<void>;
  clearPlacement: () => Promise<void>;
  learnerLevel: string | null;
  targetLanguage: CompanionChatApiLanguage | null;
};

const PlacementContext = createContext<PlacementContextValue | null>(null);

function parseRecord(raw: string | null): PlacementRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlacementRecord;
    if (!parsed?.level || !parsed.language || !parsed.completedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function PlacementProvider({ children }: { children: ReactNode }) {
  const { user, isHydrated: authHydrated } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [record, setRecord] = useState<PlacementRecord | null>(null);

  const storageKey = useMemo(() => {
    if (user?.id) return userDataKey(user.id, USER_SUFFIX.placement);
    if (DEMO_SKIP_AUTH) return DEMO_PLACEMENT_KEY;
    return null;
  }, [user?.id]);

  useEffect(() => {
    if (!authHydrated) return;
    let cancelled = false;
    (async () => {
      if (!storageKey) {
        if (!cancelled) {
          setRecord(null);
          setHydrated(true);
        }
        return;
      }
      const raw = await AsyncStorage.getItem(storageKey);
      if (!cancelled) {
        setRecord(parseRecord(raw));
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHydrated, storageKey]);

  const savePlacement = useCallback(
    async (next: PlacementRecord) => {
      if (!storageKey) return;
      setRecord(next);
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    },
    [storageKey],
  );

  const clearPlacement = useCallback(async () => {
    if (!storageKey) return;
    setRecord(null);
    await AsyncStorage.removeItem(storageKey);
  }, [storageKey]);

  const value = useMemo(
    () => ({
      hydrated,
      record,
      isComplete: Boolean(record?.completedAt),
      savePlacement,
      clearPlacement,
      learnerLevel: record?.level ?? null,
      targetLanguage: record?.language ?? null,
    }),
    [clearPlacement, hydrated, record, savePlacement],
  );

  return <PlacementContext.Provider value={value}>{children}</PlacementContext.Provider>;
}

export function usePlacement() {
  const ctx = useContext(PlacementContext);
  if (!ctx) throw new Error('usePlacement must be used within PlacementProvider');
  return ctx;
}
