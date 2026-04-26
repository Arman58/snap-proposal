"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Link2,
  FileDown,
  Mail,
  CheckCircle,
} from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  useProposalsStore,
  proposalTotal,
  formatWithCurrency,
  DEFAULT_DISPLAY_SETTINGS,
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
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

function useProposalImage(id: string): string {
  const [src, setSrc] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem("proposal-row-images-v1");
      setSrc(raw ? (JSON.parse(raw)[id] ?? "") : "");
    } catch {}
  }, [id]);
  return src;
}

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

  const total = proposalTotal(proposal.items);
  const cfg = STATUS_CONFIG[proposal.status];
  const customColumns = proposal.customColumns ?? [];
  const ds = { ...DEFAULT_DISPLAY_SETTINGS, ...proposal.displaySettings };
  const fmt = (n: number) => formatWithCurrency(n, ds.currency);
  const rowPy = ds.spacing === "compact" ? "py-2" : "py-4";
  const hasImage = proposal.items.some((i) => i.imageUrl);

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

  function handleCopyLink() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast(t("link_copied_clipboard")))
      .catch(() => toast(t("copy_link_failed")));
  }

  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const formattedDate = new Date(proposal.updatedAt).toLocaleDateString(dateLocale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      {/* ── Toolbar — hidden on print ────────────────────────────────────── */}
      <div ref={toolbarRef} className={cn("print:hidden", toolbarSticky ? "mb-24" : "mb-10")}>
        <div className={cn(
          "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between transition-all",
          toolbarSticky && "fixed top-[53px] left-0 right-0 z-30 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 px-6 py-3 shadow-lg max-w-none"
        )}>
          {/* Left */}
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

          {/* Right */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={proposal.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("draft")}</SelectItem>
                <SelectItem value="sent">{t("sent")}</SelectItem>
                <SelectItem value="accepted">{t("accepted")}</SelectItem>
                <SelectItem value="declined">{t("declined")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Declined confirmation inline pill */}
            {pendingDeclined && (
              <div className="flex items-center gap-1.5 rounded-lg border border-red-800 bg-red-950/60 px-3 py-1 text-xs animate-toast-in">
                <span className="text-red-300 font-medium">{t("mark_declined_confirm")}</span>
                <button
                  onClick={confirmDeclined}
                  className="ml-1 rounded-md bg-red-700 hover:bg-red-600 text-white px-2 py-0.5 font-semibold transition-colors"
                >
                  {t("confirm_yes")}
                </button>
                <button
                  onClick={() => setPendingDeclined(false)}
                  className="rounded-md text-red-400 hover:text-red-200 px-1.5 py-0.5 transition-colors"
                >
                  {t("confirm_no")}
                </button>
              </div>
            )}

            {proposal.status === "draft" && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-blue-800 text-blue-400 hover:bg-blue-900/20 hover:text-blue-300"
                onClick={() => updateProposal(proposal.id, { status: "sent" })}
              >
                <Mail className="h-3.5 w-3.5" />
                {t("mark_sent")}
              </Button>
            )}

            {proposal.status === "sent" && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-emerald-800 text-emerald-400 hover:bg-emerald-900/20 hover:text-emerald-300"
                onClick={() => updateProposal(proposal.id, { status: "accepted" })}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {t("mark_accepted")}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleCopyLink}
            >
              <Link2 className="h-3.5 w-3.5" />
              {t("share")}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => window.print()}
            >
              <FileDown className="h-3.5 w-3.5" />
              {t("export_pdf")}
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
        </div>
      </div>

      {/* ── Proposal document ────────────────────────────────────────────── */}
      <div className="flex justify-center">
        <div
          id="proposal-document"
          className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900
                     print:max-w-none print:rounded-none print:border-0"
          style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
        >
          {/* Accent stripe */}
          <div
            style={{
              backgroundColor: ds.accentColor,
              height: "4px",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            } as React.CSSProperties}
          />

          {/* Document header */}
          <div className="px-8 py-7 bg-white border-b border-gray-100 print:px-0 print:py-6">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                {proposalImage && (
                  <img
                    src={proposalImage}
                    alt=""
                    className="mb-3 h-14 w-14 rounded-lg object-cover"
                  />
                )}
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5"
                  style={{ color: ds.accentColor }}
                >
                  {t("commercial_proposal")}
                </p>
                <h1 className="text-xl font-semibold text-gray-900 leading-snug tracking-tight">
                  {proposal.title}
                </h1>
                {proposal.company && (
                  <p className="mt-1 text-sm font-medium text-gray-600">
                    {proposal.company}
                  </p>
                )}
                {(proposal.companyEmail || proposal.companyPhone) && (
                  <p className="mt-0.5 text-xs text-gray-400">
                    {[proposal.companyEmail, proposal.companyPhone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right space-y-3">
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.12em] mb-0.5"
                    style={{ color: ds.accentColor }}
                  >
                    {t("ref")}
                  </p>
                  <p className="font-mono text-xs text-gray-500">
                    #{proposal.id.slice(-8).toUpperCase()}
                  </p>
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.12em] mb-0.5"
                    style={{ color: ds.accentColor }}
                  >
                    {t("proposal_date")}
                  </p>
                  <p className="text-sm text-gray-700">
                    {formattedDate}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Prepared For */}
          <div className="border-b border-gray-100 px-8 py-5 print:px-0 bg-gray-50/50">
            <div className={cn("grid gap-6", proposal.company ? "grid-cols-2" : "grid-cols-1")}>
              {proposal.company && (
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2"
                    style={{ color: ds.accentColor }}
                  >
                    {t("from_label")}
                  </p>
                  <p className="text-sm font-semibold text-gray-800">{proposal.company}</p>
                  {proposal.companyEmail && (
                    <p className="mt-0.5 text-xs text-gray-500">{proposal.companyEmail}</p>
                  )}
                  {proposal.companyPhone && (
                    <p className="mt-0.5 text-xs text-gray-500">{proposal.companyPhone}</p>
                  )}
                </div>
              )}
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2"
                  style={{ color: ds.accentColor }}
                >
                  {t("prepared_for")}
                </p>
                <p className="text-sm font-semibold text-gray-800">{proposal.client}</p>
                {proposal.clientCompany && (
                  <p className="mt-0.5 text-xs text-gray-600">{proposal.clientCompany}</p>
                )}
                {proposal.clientEmail && (
                  <p className="mt-0.5 text-xs text-gray-500">{proposal.clientEmail}</p>
                )}
                {proposal.clientPhone && (
                  <p className="mt-0.5 text-xs text-gray-500">{proposal.clientPhone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Line items table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr
                  className="bg-white border-b-2"
                  style={{ borderBottomColor: ds.accentColor }}
                >
                  {hasImage && (
                    <th className="w-14 px-4 py-3 print:px-0" />
                  )}
                  <th
                    className="px-8 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] print:px-0"
                    style={{ color: ds.accentColor }}
                  >
                    {t("col_product_service")}
                  </th>
                  {ds.showDeliveryTime && (
                    <th
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] whitespace-nowrap"
                      style={{ color: ds.accentColor }}
                    >
                      {t("col_delivery_time")}
                    </th>
                  )}
                  {customColumns.map((col) => (
                    <th
                      key={col.id}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] whitespace-nowrap"
                      style={{ color: ds.accentColor }}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th
                    className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] whitespace-nowrap"
                    style={{ color: ds.accentColor }}
                  >
                    {t("col_qty")}
                  </th>
                  {ds.showPrice && (
                    <th
                      className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] whitespace-nowrap"
                      style={{ color: ds.accentColor }}
                    >
                      {t("col_unit_price")}
                    </th>
                  )}
                  {ds.showTotal && (
                    <th
                      className="px-8 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] print:px-0"
                      style={{ color: ds.accentColor }}
                    >
                      {t("col_total")}
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {proposal.items.filter((i) => i.name.trim()).map((item) => (
                  <tr key={item.id} className="group hover:bg-gray-50/70 print:hover:bg-transparent">
                    {hasImage && (
                      <td className={cn("w-14 px-4 print:px-0", rowPy)}>
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-10 w-10 object-cover rounded border border-gray-200"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded border border-dashed border-gray-200 bg-gray-50" />
                        )}
                      </td>
                    )}
                    <td className={cn("px-8 print:px-0", rowPy)}>
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      {ds.showDescription && item.description && (
                        <p className="mt-0.5 text-xs text-gray-400 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </td>
                    {ds.showDeliveryTime && (
                      <td className={cn("px-4 text-sm text-gray-500 whitespace-nowrap", rowPy)}>
                        {item.deliveryTime || "—"}
                      </td>
                    )}
                    {customColumns.map((col) => (
                      <td
                        key={col.id}
                        className={cn("px-4 text-sm text-gray-500 whitespace-nowrap", rowPy)}
                      >
                        {item.attrs?.[col.id] || "—"}
                      </td>
                    ))}
                    <td className={cn("px-4 text-right tabular-nums text-sm text-gray-600 whitespace-nowrap", rowPy)}>
                      {item.qty} {item.unit}
                    </td>
                    {ds.showPrice && (
                      <td className={cn("px-4 text-right tabular-nums text-sm text-gray-600 whitespace-nowrap", rowPy)}>
                        {fmt(item.unitPrice)}
                      </td>
                    )}
                    {ds.showTotal && (
                      <td className={cn("px-8 text-right tabular-nums text-sm font-semibold text-gray-900 whitespace-nowrap print:px-0", rowPy)}>
                        {fmt(item.qty * item.unitPrice)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          {ds.showTotal && (
            <div className="flex justify-end border-t border-gray-100 px-8 py-5 print:px-0">
              <dl className="w-56 space-y-2">
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500">{t("subtotal")}</dt>
                  <dd className="tabular-nums text-gray-700 font-mono">
                    {fmt(total)}
                  </dd>
                </div>
                <Separator style={{ backgroundColor: ds.accentColor + "33" }} />
                <div className="flex justify-between">
                  <dt
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: ds.accentColor }}
                  >
                    {t("col_total")}
                  </dt>
                  <dd
                    className="text-base font-bold tabular-nums font-mono"
                    style={{ color: ds.accentColor }}
                  >
                    {fmt(total)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Notes */}
          {proposal.notes && (
            <div className="border-t border-gray-100 px-8 py-5 print:px-0">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2"
                style={{ color: ds.accentColor }}
              >
                {t("proposal_notes")}
              </p>
              <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-wrap">
                {proposal.notes}
              </p>
            </div>
          )}

          {/* Signature block */}
          <div className="border-t border-gray-100 px-8 py-8 print:px-0">
            <div className="grid grid-cols-2 gap-16">
              <div>
                <div
                  className="h-9 border-b-2 border-dashed"
                  style={{ borderColor: ds.accentColor + "55" }}
                />
                <p className="mt-2 text-xs text-gray-400">{t("signature_date")}</p>
                {proposal.company && (
                  <p className="mt-0.5 text-xs font-medium text-gray-600">
                    {proposal.company}
                  </p>
                )}
              </div>
              <div>
                <div
                  className="h-9 border-b-2 border-dashed"
                  style={{ borderColor: ds.accentColor + "55" }}
                />
                <p className="mt-2 text-xs text-gray-400">{t("client_signature_date")}</p>
                <p className="mt-0.5 text-xs font-medium text-gray-600">
                  {proposal.client}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
