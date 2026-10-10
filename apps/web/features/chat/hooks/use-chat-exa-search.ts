"use client";

import * as React from "react";

const EXA_SEARCH_STORAGE_KEY = "deeix-chat:exa-search:v1";
const useIsomorphicLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

function readExaSearchEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(EXA_SEARCH_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeExaSearchEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(EXA_SEARCH_STORAGE_KEY, String(enabled));
  } catch {
    // localStorage may be unavailable in private browsing or strict environments.
  }
}

export function useChatExaSearch() {
  const [enabled, setEnabledState] = React.useState(false);

  useIsomorphicLayoutEffect(() => {
    setEnabledState(readExaSearchEnabled());
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function onStorage(event: StorageEvent) {
      if (event.key === EXA_SEARCH_STORAGE_KEY) {
        setEnabledState(event.newValue === "true");
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setEnabled = React.useCallback((next: React.SetStateAction<boolean>) => {
    setEnabledState((previous) => {
      const resolved = typeof next === "function" ? next(previous) : next;
      writeExaSearchEnabled(resolved);
      return resolved;
    });
  }, []);

  return {
    enabled,
    setEnabled,
  };
}
