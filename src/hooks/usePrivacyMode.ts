import { useCallback, useEffect, useState } from 'react';
import type { HostAPI } from '@wealthfolio/addon-sdk';

const STORAGE_KEY = 'privacy-mode';

/**
 * Addon-local privacy toggle, persisted via ctx.api.storage. Not linked to
 * the host app's own privacy/hide-balance feature - that's implemented via
 * localStorage + a window CustomEvent on the host's top-level window, which
 * isn't reachable from inside the addon's sandboxed iframe (a separate
 * window/origin, and localStorage itself throws in the sandbox).
 */
export function usePrivacyMode(api: HostAPI) {
  const [privacyMode, setPrivacyModeState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api.storage.get(STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      if (raw === 'true') {
        setPrivacyModeState(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const setPrivacyMode = useCallback(
    (next: boolean) => {
      setPrivacyModeState(next);
      void api.storage.set(STORAGE_KEY, next ? 'true' : 'false');
    },
    [api],
  );

  return { privacyMode, setPrivacyMode };
}
