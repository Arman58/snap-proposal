"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { StickyNote, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useProposalsStore } from "@/store/proposals";

// ─── Theme color ──────────────────────────────────────────────────────────────

const THEME_KEY = "app-theme-color";
const DEFAULT_COLOR = "#6366f1";

function useThemeColor() {
  const [color, setColor] = useState(DEFAULT_COLOR);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) ?? DEFAULT_COLOR;
    setColor(stored);
    document.documentElement.style.setProperty("--theme-color", stored);
  }, []);

  function updateColor(c: string) {
    setColor(c);
    localStorage.setItem(THEME_KEY, c);
    document.documentElement.style.setProperty("--theme-color", c);
  }

  return { color, updateColor };
}

// ─── Breadcrumb helper ────────────────────────────────────────────────────────

function useBreadcrumbs() {
  const pathname = usePathname();
  const { getProposal } = useProposalsStore();
  const t = useT();

  // Match /proposal/[id] or /proposal/[id]/edit
  const proposalMatch = pathname.match(/^\/proposal\/([^/]+)(\/edit)?$/);
  if (!proposalMatch) return null;

  const id = proposalMatch[1];
  const isEdit = !!proposalMatch[2];
  const proposal = getProposal(id);
  const title = proposal?.title ?? "…";

  return {
    segments: [
      { href: "/dashboard", label: t("proposals") },
      ...(isEdit
        ? [
            { href: `/proposal/${id}`, label: title },
            { href: `/proposal/${id}/edit`, label: t("edit") },
          ]
        : [{ href: `/proposal/${id}`, label: title }]),
    ],
  };
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

export function Nav() {
  const pathname = usePathname();
  const t = useT();
  const { color, updateColor } = useThemeColor();
  const breadcrumbs = useBreadcrumbs();

  const NAV_LINKS = [
    { href: "/dashboard", label: t("proposals") },
  ];

  const isDashboard = pathname === "/dashboard";

  return (
    <header
      className="sticky top-0 z-40 border-b bg-zinc-950/90 backdrop-blur-sm"
      style={{ borderBottomColor: color }}
    >
        <div className="mx-auto flex h-[52px] max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand + breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-zinc-100 hover:text-white transition-colors shrink-0"
          >
            <StickyNote className="h-4 w-4 shrink-0" />
            <span className="text-sm font-semibold tracking-tight hidden sm:block">
              {t("app_brand")}
            </span>
          </Link>

          {/* Dashboard nav link with active indicator */}
          {isDashboard && (
            <nav className="flex items-center gap-0.5">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="relative rounded-md px-2.5 py-1.5 text-sm transition-colors text-zinc-100"
                >
                  {label}
                  <span
                    className="absolute inset-x-2.5 -bottom-px h-[2px] rounded-t-full"
                    style={{ backgroundColor: color }}
                  />
                </Link>
              ))}
            </nav>
          )}

          {/* Breadcrumbs for proposal pages */}
          {breadcrumbs && (
            <nav className="flex items-center gap-1 min-w-0 text-sm" aria-label={t("breadcrumb")}>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-700 shrink-0" />
              {breadcrumbs.segments.map((seg, i) => {
                const isLast = i === breadcrumbs.segments.length - 1;
                return (
                  <span key={seg.href} className="flex items-center gap-1 min-w-0">
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-zinc-700 shrink-0" />}
                    {isLast ? (
                      <span className="truncate text-zinc-200 font-medium max-w-[160px] sm:max-w-[280px]">
                        {seg.label}
                      </span>
                    ) : (
                      <Link
                        href={seg.href}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors truncate max-w-[120px]"
                      >
                        {seg.label}
                      </Link>
                    )}
                  </span>
                );
              })}
            </nav>
          )}
        </div>

        {/* Right side: theme picker + language switcher + CTA */}
        <div className="flex items-center gap-2">
          {/* Color swatch — triggers native color picker */}
          <label
            title={t("theme_color")}
            className="relative cursor-pointer h-6 w-6 rounded-full border-2 border-white/20 hover:border-white/50 transition-colors shrink-0"
            style={{ backgroundColor: color }}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => updateColor(e.target.value)}
              className="sr-only"
            />
          </label>
          <LanguageSwitcher />
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/proposal/new">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:block">{t("new_proposal")}</span>
              <span className="sm:hidden">{t("new")}</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
