"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProposalsStore } from "@/store/proposals";
import { useI18n } from "@/lib/i18n";
import { ProposalDocument } from "@/components/proposal/proposal-document";
import { useProposalImage } from "@/lib/use-proposal-image";

export function ProposalPublicClient() {
  const { id } = useParams<{ id: string }>();
  const { getProposal } = useProposalsStore();
  const { locale, t } = useI18n();
  const proposal = id ? getProposal(id) : undefined;
  const proposalImage = useProposalImage(id ?? "");

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <p className="text-base font-medium text-zinc-200">{t("proposal_not_found")}</p>
        <p className="mt-1.5 text-sm text-zinc-500">{t("proposal_not_found_desc")}</p>
      </div>
    );
  }

  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const formattedDate = new Date(proposal.updatedAt).toLocaleDateString(dateLocale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8 print:hidden">
        <p className="text-xs text-zinc-500">{t("client_view_banner")}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-zinc-700"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" />
            {t("print_save_pdf")}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-zinc-400" asChild>
            <Link href="/dashboard">{t("app_brand")}</Link>
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 mb-6 print:hidden">{t("print_pdf_hint")}</p>

      <ProposalDocument
        proposal={proposal}
        proposalImage={proposalImage}
        formattedDate={formattedDate}
        clientMode
      />
    </div>
  );
}
