/** Web stub — live mic недоступен в демо-браузере. */
export function useCompanionLiveMic() {
  return {
    startStreaming: async (_onChunk: (b64: string) => void) => false,
    stopStreaming: async () => {},
    supportsLiveMic: false,
  };
}
