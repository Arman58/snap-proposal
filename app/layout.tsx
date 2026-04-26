import type { Metadata } from "next";
import "./globals.css";
import { SiteShell } from "@/components/layout/site-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "ProposalBuilder",
  description: "Turn a list of products into a client-ready commercial proposal.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className="min-h-screen bg-zinc-950 text-zinc-100 antialiased"
        suppressHydrationWarning
      >
        <I18nProvider>
          <TooltipProvider>
            <SiteShell>{children}</SiteShell>
          </TooltipProvider>
        </I18nProvider>
        <Toaster />
      </body>
    </html>
  );
}
