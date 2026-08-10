"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import { LANGUAGES } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useTranslation();

  return (
    <div className={cn("flex gap-0.5 bg-white/10 rounded-md p-0.5", compact && "justify-center")}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={cn(
            "px-1.5 py-1 rounded text-[10px] font-semibold transition-colors flex-1",
            language === lang.code ? "bg-white text-brand-700" : "text-white/70 hover:text-white hover:bg-white/10"
          )}
          title={lang.label}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
