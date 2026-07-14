import { useCallback, useEffect, useState } from 'react';
import type { HostAPI } from '@wealthfolio/addon-sdk';

const STORAGE_KEY = 'dismissed-pairs';

/** Persists dismissed pair keys via ctx.api.storage so re-scans don't resurface them. */
export function useDismissed(api: HostAPI) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api.storage.get(STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      if (raw) {
        try {
          setDismissed(new Set(JSON.parse(raw) as string[]));
        } catch {
          // corrupt/legacy value, start fresh
        }
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const dismiss = useCallback(
    (key: string) => {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(key);
        void api.storage.set(STORAGE_KEY, JSON.stringify(Array.from(next)));
        return next;
      });
    },
    [api],
  );

  return { dismissed, dismiss, loaded };
}
