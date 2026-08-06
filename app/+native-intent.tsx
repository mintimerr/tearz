/**
 * Deep link `tearzmobile:///` даёт Unmatched Route.
 * Нормализуем пустые / неизвестные URL в корень приложения.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  const raw = (path ?? '').trim();
  if (!raw) return '/';

  // tearzmobile:///  |  tearzmobile://  |  exp+…/?url=…
  try {
    if (raw.includes('://')) {
      const u = new URL(raw);
      // Development client: URL in query
      const nested = u.searchParams.get('url');
      if (nested) {
        return redirectSystemPath({ path: nested, initial: false });
      }
      let p = u.pathname || '/';
      // tearzmobile:/// → pathname often "/" or ""
      if (!p || p === '/' || p === '//') return '/';
      // strip trailing slash noise
      if (p.endsWith('/') && p.length > 1) p = p.slice(0, -1);
      return p.startsWith('/') ? p : `/${p}`;
    }
  } catch {
    // fall through
  }

  const cleaned = raw.replace(/^\/+/, '').trim();
  if (!cleaned) return '/';
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}
