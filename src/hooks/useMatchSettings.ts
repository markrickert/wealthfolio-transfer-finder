import { useCallback, useEffect, useState } from 'react';
import type { HostAPI } from '@wealthfolio/addon-sdk';
import { DEFAULT_SETTINGS, type MatchSettings } from '../types/pair';

const STORAGE_KEY = 'match-settings';

export function useMatchSettings(api: HostAPI) {
  const [settings, setSettingsState] = useState<MatchSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api.storage.get(STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      if (raw) {
        try {
          setSettingsState({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<MatchSettings>) });
        } catch {
          // corrupt/legacy value, keep defaults
        }
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const setSettings = useCallback(
    (next: MatchSettings) => {
      setSettingsState(next);
      void api.storage.set(STORAGE_KEY, JSON.stringify(next));
    },
    [api],
  );

  return { settings, setSettings, loaded };
}
