"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import { LANGUAGES } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useTranslation();

  return (
    <div className={cn("flex gap-0.5 bg-apple-fill rounded-lg p-0.5", compact && "justify-center")}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={cn(
            "px-1.5 py-1 rounded-md text-[11px] font-medium transition-all flex-1",
            language === lang.code ? "bg-white text-apple-label shadow-sm" : "text-apple-secondary hover:text-apple-label"
          )}
          title={lang.label}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
