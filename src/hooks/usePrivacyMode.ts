import { useCallback, useEffect, useState } from "react";
import type { HostAPI } from "@wealthfolio/addon-sdk";

const STORAGE_KEY = "privacy-mode";

export type PrivacyLevel = "off" | "hidden" | "ultra";

function isPrivacyLevel(value: string): value is PrivacyLevel {
  return value === "off" || value === "hidden" || value === "ultra";
}

/**
 * Addon-local privacy toggle, persisted via ctx.api.storage. Not linked to
 * the host app's own privacy/hide-balance feature - that's implemented via
 * localStorage + a window CustomEvent on the host's top-level window, which
 * isn't reachable from inside the addon's sandboxed iframe (a separate
 * window/origin, and localStorage itself throws in the sandbox).
 *
 * Two levels beyond 'off':
 * - 'hidden': amounts masked with "••••", names untouched (click).
 * - 'ultra': amounts AND institution/account names replaced with plausible
 *   fake values, stable for as long as ultra stays on - for taking
 *   screenshots without leaking real data (long-press).
 */
export function usePrivacyMode(api: HostAPI) {
  const [privacyLevel, setPrivacyLevelState] = useState<PrivacyLevel>("off");

  useEffect(() => {
    let cancelled = false;
    void api.storage.get(STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      if (raw && isPrivacyLevel(raw)) {
        setPrivacyLevelState(raw);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const setPrivacyLevel = useCallback(
    (next: PrivacyLevel) => {
      setPrivacyLevelState(next);
      void api.storage.set(STORAGE_KEY, next);
    },
    [api],
  );

  const toggleHidden = useCallback(() => {
    setPrivacyLevel(privacyLevel === "off" ? "hidden" : "off");
  }, [privacyLevel, setPrivacyLevel]);

  const toggleUltra = useCallback(() => {
    setPrivacyLevel(privacyLevel === "ultra" ? "off" : "ultra");
  }, [privacyLevel, setPrivacyLevel]);

  return { privacyLevel, setPrivacyLevel, toggleHidden, toggleUltra };
}
