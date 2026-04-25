"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Pencil,
  Link2,
  Check,
  FileDown,
  Mail,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  useProposalsStore,
  proposalTotal,
  formatCurrency,
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

export function ProposalViewClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getProposal, updateProposal } = useProposalsStore();

  const [copied, setCopied] = useState(false);

  const proposal = getProposal(id);

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center">
        <p className="text-base font-medium text-zinc-200">Proposal not found</p>
        <p className="mt-1.5 text-sm text-zinc-500">
          This proposal may have been deleted or doesn&apos;t exist.
        </p>
        <Button className="mt-6" asChild variant="outline" size="sm">
          <Link href="/dashboard">Back to Proposals</Link>
        </Button>
      </div>
    );
  }

  const total = proposalTotal(proposal.items);
  const cfg = STATUS_CONFIG[proposal.status];
  const customColumns = proposal.customColumns ?? [];

  function handleStatusChange(value: string) {
    updateProposal(proposal!.id, { status: value as ProposalStatus });
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const formattedDate = new Date(proposal.updatedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      {/* ── Toolbar — hidden on print ────────────────────────────────────── */}
      <div className="print:hidden mb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                {cfg.label}
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
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>

            {proposal.status === "draft" && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-blue-800 text-blue-400 hover:bg-blue-900/20 hover:text-blue-300"
                onClick={() => updateProposal(proposal.id, { status: "sent" })}
              >
                <Mail className="h-3.5 w-3.5" />
                Mark Sent
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
                Mark Accepted
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5" />
                  Share
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => window.print()}
            >
              <FileDown className="h-3.5 w-3.5" />
              Export PDF
            </Button>

            <Button
              size="sm"
              className="h-8"
              onClick={() => router.push(`/proposal/${proposal.id}/edit`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* ── Proposal document ────────────────────────────────────────────── */}
      <div className="flex justify-center">
        <div
          id="proposal-document"
          className="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-800 bg-white text-gray-900
                     print:max-w-none print:rounded-none print:border-0"
        >
          {/* Document header band */}
          <div className="bg-zinc-950 px-8 py-7 print:px-0 print:py-0 print:pb-6 print:border-b print:border-gray-900">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                {proposal.company && (
                  <p className="text-xs font-medium text-zinc-400 print:text-gray-500 tracking-wide mb-1">
                    {proposal.company}
                  </p>
                )}
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600 print:text-gray-400">
                  Commercial Proposal
                </p>
                <h1 className="mt-1.5 text-xl font-semibold text-zinc-50 print:text-gray-900 leading-snug tracking-tight">
                  {proposal.title}
                </h1>
              </div>

              <div className="shrink-0 text-right space-y-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 print:text-gray-400">
                    Ref
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-zinc-400 print:text-gray-500">
                    #{proposal.id.slice(-8).toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 print:text-gray-400">
                    Date
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-300 print:text-gray-700">
                    {formattedDate}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* From / To */}
          <div
            className={cn(
              "grid gap-6 border-b border-gray-100 px-8 py-5 print:px-0",
              proposal.company ? "grid-cols-2" : "grid-cols-1"
            )}
          >
            {proposal.company && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">
                  From
                </p>
                <p className="text-sm font-medium text-gray-800">{proposal.company}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">
                Prepared For
              </p>
              <p className="text-sm font-medium text-gray-800">{proposal.client}</p>
              {proposal.clientEmail && (
                <p className="mt-0.5 text-xs text-gray-500">{proposal.clientEmail}</p>
              )}
            </div>
          </div>

          {/* Line items table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-100">
                  <th className="px-8 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 print:px-0">
                    Product / Service
                  </th>
                  {customColumns.map((col) => (
                    <th
                      key={col.id}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 whitespace-nowrap">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 whitespace-nowrap">
                    Unit Price
                  </th>
                  <th className="px-8 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 print:px-0">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {proposal.items.map((item) => (
                  <tr key={item.id} className="group hover:bg-gray-50/70 print:hover:bg-transparent">
                    <td className="px-8 py-4 print:px-0">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-gray-400 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </td>
                    {customColumns.map((col) => (
                      <td
                        key={col.id}
                        className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap"
                      >
                        {item.attrs?.[col.id] || "—"}
                      </td>
                    ))}
                    <td className="px-4 py-4 text-right tabular-nums text-sm text-gray-600 whitespace-nowrap">
                      {item.qty} {item.unit}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums text-sm text-gray-600 whitespace-nowrap">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-8 py-4 text-right tabular-nums text-sm font-semibold text-gray-900 whitespace-nowrap print:px-0">
                      {formatCurrency(item.qty * item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end border-t border-gray-100 px-8 py-5 print:px-0">
            <dl className="w-56 space-y-2">
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Subtotal</dt>
                <dd className="tabular-nums text-gray-700 font-mono">
                  {formatCurrency(total)}
                </dd>
              </div>
              <Separator className="bg-gray-200" />
              <div className="flex justify-between">
                <dt className="text-sm font-semibold text-gray-900">Total</dt>
                <dd className="text-base font-bold tabular-nums text-gray-900 font-mono">
                  {formatCurrency(total)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Notes */}
          {proposal.notes && (
            <div className="border-t border-gray-100 px-8 py-5 print:px-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">
                Notes
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
                <div className="h-9 border-b border-gray-200" />
                <p className="mt-2 text-xs text-gray-400">Signature &amp; date</p>
                {proposal.company && (
                  <p className="mt-0.5 text-xs font-medium text-gray-600">
                    {proposal.company}
                  </p>
                )}
              </div>
              <div>
                <div className="h-9 border-b border-gray-200" />
                <p className="mt-2 text-xs text-gray-400">Client signature &amp; date</p>
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
