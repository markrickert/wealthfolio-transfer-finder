import { useRef } from "react";
import { Button, Icons } from "@wealthfolio/ui";
import type { PrivacyLevel } from "../hooks/usePrivacyMode";

const LONG_PRESS_MS = 500;

/** Click toggles normal ("••••") privacy; press-and-hold toggles ultra
 * privacy (fake institution names + fake amounts, for screenshots). */
export function PrivacyToggleButton({
  privacyLevel,
  toggleHidden,
  toggleUltra,
}: {
  privacyLevel: PrivacyLevel;
  toggleHidden: () => void;
  toggleUltra: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  function startPress() {
    longPressFiredRef.current = false;
    timerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      toggleUltra();
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleClick() {
    // A long-press still fires a trailing click on release - swallow that
    // one so it doesn't also toggle normal privacy.
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    toggleHidden();
  }

  const label =
    privacyLevel === "off"
      ? "Hide amounts (hold for ultra privacy)"
      : privacyLevel === "hidden"
        ? "Show amounts"
        : "Exit ultra privacy";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="shrink-0"
      aria-label={label}
      title={label}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
      onClick={handleClick}
    >
      {privacyLevel === "off" ? (
        <Icons.Eye className="h-4 w-4" />
      ) : (
        <Icons.EyeOff className={`h-4 w-4 ${privacyLevel === "ultra" ? "text-primary" : ""}`} />
      )}
    </Button>
  );
}
