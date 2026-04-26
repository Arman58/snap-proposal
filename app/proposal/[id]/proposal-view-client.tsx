"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Link2,
  Printer,
  Users,
} from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import {
  useProposalsStore,
  STATUS_CONFIG,
  type ProposalStatus,
} from "@/store/proposals";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { ProposalDocument } from "@/components/proposal/proposal-document";
import { useProposalImage } from "@/lib/use-proposal-image";

export function ProposalViewClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getProposal, updateProposal } = useProposalsStore();

  const { locale, t } = useI18n();

  const proposal = getProposal(id);
  const proposalImage = useProposalImage(id);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarSticky, setToolbarSticky] = useState(false);
  const [pendingDeclined, setPendingDeclined] = useState(false);

  useEffect(() => {
    const sentinel = toolbarRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setToolbarSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-53px 0px 0px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center">
        <p className="text-base font-medium text-zinc-200">{t("proposal_not_found")}</p>
        <p className="mt-1.5 text-sm text-zinc-500">
          {t("proposal_not_found_desc")}
        </p>
        <Button className="mt-6" asChild variant="outline" size="sm">
          <Link href="/dashboard">{t("back_to_proposals")}</Link>
        </Button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[proposal.status];

  function handleStatusChange(value: string) {
    if (value === "declined") {
      setPendingDeclined(true);
      return;
    }
    updateProposal(proposal!.id, { status: value as ProposalStatus });
  }

  function confirmDeclined() {
    updateProposal(proposal!.id, { status: "declined" });
    setPendingDeclined(false);
  }

  function copyUrl(url: string, successKey: string) {
    navigator.clipboard
      .writeText(url)
      .then(() => toast(t(successKey)))
      .catch(() => toast(t("copy_link_failed")));
  }

  function handleCopyInternalLink() {
    copyUrl(window.location.href, "link_copied_clipboard");
  }

  function handleCopyClientLink() {
    const url = `${window.location.origin}/p/${proposal!.id}`;
    copyUrl(url, "client_link_copied");
  }

  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const formattedDate = new Date(proposal.updatedAt).toLocaleDateString(dateLocale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <div ref={toolbarRef} className={cn("print:hidden", toolbarSticky ? "mb-24" : "mb-10")}>
        <div
          className={cn(
            "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between transition-all",
            toolbarSticky &&
              "fixed top-[53px] left-0 right-0 z-30 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 px-6 py-3 shadow-lg max-w-none"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-100">
                {proposal.title}
              </h1>
              <span
                className={cn(
                  "shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
                  cfg.className
                )}
              >
                {t(proposal.status)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex items-center gap-2 flex-wrap sm:justify-end">
              <Select value={proposal.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-8 min-w-[8.5rem] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("draft")}</SelectItem>
                  <SelectItem value="sent">{t("sent")}</SelectItem>
                  <SelectItem value="accepted">{t("accepted")}</SelectItem>
                  <SelectItem value="declined">{t("declined")}</SelectItem>
                </SelectContent>
              </Select>

              {pendingDeclined && (
                <div className="flex items-center gap-1.5 rounded-lg border border-red-800 bg-red-950/60 px-3 py-1 text-xs animate-toast-in">
                  <span className="text-red-300 font-medium">{t("mark_declined_confirm")}</span>
                  <button
                    type="button"
                    onClick={confirmDeclined}
                    className="ml-1 rounded-md bg-red-700 hover:bg-red-600 text-white px-2 py-0.5 font-semibold transition-colors"
                  >
                    {t("confirm_yes")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeclined(false)}
                    className="rounded-md text-red-400 hover:text-red-200 px-1.5 py-0.5 transition-colors"
                  >
                    {t("confirm_no")}
                  </button>
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    {t("share")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleCopyInternalLink}>
                    <Link2 className="h-3.5 w-3.5" />
                    {t("copy_internal_link")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyClientLink}>
                    <Users className="h-3.5 w-3.5" />
                    {t("copy_client_link")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => window.print()}
              >
                <Printer className="h-3.5 w-3.5" />
                {t("print_save_pdf")}
              </Button>

              <Button
                size="sm"
                className="h-8"
                onClick={() => router.push(`/proposal/${proposal.id}/edit`)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("edit")}
              </Button>
            </div>
            <p className="text-[11px] text-zinc-500 max-w-md text-right leading-snug print:hidden">
              {t("print_pdf_hint")}
            </p>
          </div>
        </div>
      </div>

      <ProposalDocument
        proposal={proposal}
        proposalImage={proposalImage}
        formattedDate={formattedDate}
      />
    </>
  );
}
