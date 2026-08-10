"use client";

import { useLanguageStore } from "@/store/useLanguageStore";
import { translations, type TranslationKeys } from "./translations";

type Section = keyof TranslationKeys;

/**
 * `t("customers.addCustomer")` — dotted path into the translations
 * dictionary for the current language, with placeholder substitution
 * (`{name}` etc.) and an automatic fallback to English if a key is ever
 * missing in another language (keeps the UI from showing a raw key
 * instead of text while hi/mr coverage is still catching up).
 */
export function useTranslation() {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  function t(path: `${Section}.${string}`, vars?: Record<string, string | number>): string {
    const [section, key] = path.split(".") as [Section, string];
    const dict = translations[language]?.[section] as Record<string, string> | undefined;
    const fallbackDict = translations.en[section] as Record<string, string>;
    let value = dict?.[key] ?? fallbackDict?.[key] ?? path;

    if (vars) {
      for (const [varKey, varValue] of Object.entries(vars)) {
        value = value.replace(`{${varKey}}`, String(varValue));
      }
    }
    return value;
  }

  return { t, language, setLanguage };
}
