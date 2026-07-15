export class AbortError extends Error {
  override name = 'AbortError';

  constructor(message = 'Aborted') {
    super(message);
  }
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new AbortError();
}

export function isAbortError(e: unknown): boolean {
  if (e instanceof AbortError) return true;
  if (e instanceof Error && e.name === 'AbortError') return true;
  return typeof e === 'object' && e !== null && 'name' in e && (e as { name?: string }).name === 'AbortError';
}
