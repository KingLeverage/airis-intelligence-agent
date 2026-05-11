import { useCallback, useState } from "react";

const START_FAST_KEY = "airis.home.startFastOpen";
const DISMISSED_AT_KEY = "airis.home.startFastDismissedAt";

function readStartFastOpen(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(START_FAST_KEY);
  if (raw === "false") return false;
  return true;
}

function readDismissedAt(): string | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(START_FAST_KEY) !== "false") return null;
  return localStorage.getItem(DISMISSED_AT_KEY);
}

export function useHomePreferences() {
  const [startFastOpen, setStartFastOpenState] = useState(readStartFastOpen);
  const [dismissedAt, setDismissedAt] = useState<string | null>(readDismissedAt);

  const setStartFastOpen = useCallback((open: boolean) => {
    setStartFastOpenState(open);
    if (typeof window !== "undefined") {
      localStorage.setItem(START_FAST_KEY, String(open));
      if (open) {
        localStorage.removeItem(DISMISSED_AT_KEY);
        setDismissedAt(null);
      } else {
        const at = new Date().toISOString();
        localStorage.setItem(DISMISSED_AT_KEY, at);
        setDismissedAt(at);
      }
    }
  }, []);

  return { startFastOpen, setStartFastOpen, dismissedAt };
}
