"use client";

import { usePathname } from "next/navigation";
import { Nav } from "@/components/layout/nav";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicProposal = pathname.startsWith("/p/");

  if (isPublicProposal) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </div>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
