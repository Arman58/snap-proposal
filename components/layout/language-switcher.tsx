"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// ─── Locale config ────────────────────────────────────────────────────────────

const LOCALE_OPTIONS: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
];

const FLAG: Record<Locale, string> = {
  en: "🇬🇧",
  ru: "🇷🇺",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 focus-visible:ring-0"
          aria-label={t("switch_language")}
        >
          <span className="text-base leading-none">{FLAG[locale]}</span>
          <span className="text-[11px] font-semibold tracking-widest uppercase">
            {locale}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-36 p-1">
        {LOCALE_OPTIONS.map(({ code, label, flag }) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLocale(code)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm cursor-pointer",
              locale === code
                ? "text-zinc-100 font-medium"
                : "text-zinc-400"
            )}
          >
            <span className="text-base leading-none">{flag}</span>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
