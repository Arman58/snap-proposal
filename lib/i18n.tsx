"use client";

/**
 * Lightweight i18n — no external dependencies.
 *
 * Usage:
 *   const t = useT();
 *   t("new_proposal") // → "New Proposal" | "Новое предложение"
 *
 * Wrap your app with <I18nProvider> in app/layout.tsx.
 * Default language: Russian ("ru"). Fallback: English ("en").
 * Language persists to localStorage under the key "locale".
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import en from "@/locales/en.json";
import ru from "@/locales/ru.json";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Locale = "en" | "ru";

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

// ─── Dictionaries ─────────────────────────────────────────────────────────────

const dictionaries: Record<Locale, Record<string, string>> = { en, ru };

export const SUPPORTED_LOCALES: Locale[] = ["en", "ru"];

const STORAGE_KEY = "locale";
const DEFAULT_LOCALE: Locale = "ru";
const FALLBACK_LOCALE: Locale = "en";

// ─── Context ──────────────────────────────────────────────────────────────────

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && SUPPORTED_LOCALES.includes(stored)) {
        setLocaleState(stored);
      }
    } catch {
      // localStorage unavailable (SSR guard, private browsing, etc.)
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  // t() looks up key in active dictionary → falls back to FALLBACK_LOCALE → then the key itself
  const t = useCallback(
    (key: string): string =>
      dictionaries[locale][key] ??
      dictionaries[FALLBACK_LOCALE][key] ??
      key,
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Full context — locale, setLocale, t */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

/** Shorthand: just the t() function */
export function useT(): (key: string) => string {
  return useContext(I18nContext).t;
}
