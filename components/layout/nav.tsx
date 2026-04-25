"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StickyNote, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Proposals" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto flex h-[52px] max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-7">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-zinc-100 hover:text-white transition-colors"
          >
            <StickyNote className="h-4 w-4 shrink-0" />
            <span className="text-sm font-semibold tracking-tight hidden sm:block">
              ProposalBuilder
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-0.5">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  pathname === href || pathname.startsWith(href + "/")
                    ? "text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* CTA */}
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/proposal/new">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:block">New Proposal</span>
            <span className="sm:hidden">New</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
