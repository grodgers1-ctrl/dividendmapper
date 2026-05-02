"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";
import type { Locale, LocaleConfig } from "./types";
import { CONFIGS, UK_CONFIG } from "./configs";

const STORAGE_KEY = "dm_locale";
const LOCALE_CHANGE_EVENT = "dm:locale-change";

interface LocaleContextValue {
  config: LocaleConfig;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  config: UK_CONFIG,
  setLocale: () => {},
});

function readLocale(): Locale {
  if (typeof window === "undefined") return "uk";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "uk" || stored === "us") return stored;
  const lang = window.navigator.language?.toLowerCase() ?? "";
  if (lang.startsWith("en-us") || lang.startsWith("en-ca")) return "us";
  return "uk";
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  const onCustom = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(LOCALE_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOCALE_CHANGE_EVENT, onCustom);
  };
}

const getServerSnapshot = (): Locale => "uk";

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, readLocale, getServerSnapshot);
  const config = CONFIGS[locale];

  const setLocale = useCallback((l: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, l);
    // useSyncExternalStore subscribes to the 'storage' event, but that only
    // fires in *other* tabs. Dispatch a custom event for the current tab.
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
  }, []);

  return (
    <LocaleContext.Provider value={{ config, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);
