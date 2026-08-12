import { useCallback, useState } from 'react';

import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';

export type CompanionCallPhase =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'ended'
  | 'error';

type CallStartPayload = {
  language: CompanionChatApiLanguage;
  companionDisplayName: string;
  companionPersona?: string;
};

/** Web stub — звонки пока только в native. */
export function useCompanionCall() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<CompanionCallPhase>('idle');
  const [error, setError] = useState<string | null>('Звонки в веб-демо пока недоступны');
  const [elapsedSec] = useState(0);

  const startCall = useCallback(async (_payload: CallStartPayload) => {
    setVisible(true);
    setPhase('error');
    setError('Звонки в веб-демо пока недоступны');
  }, []);

  const endCall = useCallback(() => {
    setVisible(false);
    setPhase('idle');
    setError(null);
  }, []);

  return {
    visible,
    phase,
    error,
    elapsedSec,
    startCall,
    endCall,
    isBusy: false,
  };
}
