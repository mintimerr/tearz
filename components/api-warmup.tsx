import { useEffect } from 'react';

import { warmCompanionApi } from '@/utils/companion-api-fetch';

/** Разбудить Render при старте приложения (free tier засыпает ~15 мин). */
export function ApiWarmup() {
  useEffect(() => {
    void warmCompanionApi(6);
  }, []);

  return null;
}
