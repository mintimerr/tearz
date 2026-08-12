/** Web stub — voice recorder недоступен в демо-браузере. */
export function useCompanionVoiceRecorder() {
  return {
    isRecording: false,
    durationMs: 0,
    metering: undefined as number | undefined,
    startRecording: async (_onAutoStop?: () => void) => false,
    stopRecording: async () => null as { uri: string; durationMs: number } | null,
    cancelRecording: async () => {},
  };
}
