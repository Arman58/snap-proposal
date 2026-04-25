"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Plus,
  FileText,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useProposalsStore,
  proposalTotal,
  formatCurrency,
  type ProposalStatus,
} from "@/store/proposals";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_DOT: Record<ProposalStatus, string> = {
  draft: "bg-zinc-500",
  sent: "bg-blue-400",
  accepted: "bg-emerald-400",
  declined: "bg-red-400",
};

const STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
};

const STATUS_BADGE: Record<ProposalStatus, string> = {
  draft: "bg-zinc-800 text-zinc-400",
  sent: "bg-blue-900/50 text-blue-300",
  accepted: "bg-emerald-900/50 text-emerald-300",
  declined: "bg-red-900/50 text-red-300",
};

// ─── Stat keys ────────────────────────────────────────────────────────────────

const STAT_DEFS = [
  { key: "total" as const, label: "Total" },
  { key: "draft" as const, label: "Draft" },
  { key: "sent" as const, label: "Sent" },
  { key: "accepted" as const, label: "Accepted" },
] as const;

const STATUS_FILTERS: Array<{ value: ProposalStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardClient() {
  const router = useRouter();
  const { proposals, deleteProposal } = useProposalsStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "all">("all");
  const t = useT();

  const stats = {
    total: proposals.length,
    draft: proposals.filter((p) => p.status === "draft").length,
    sent: proposals.filter((p) => p.status === "sent").length,
    accepted: proposals.filter((p) => p.status === "accepted").length,
  };

  const filtered = proposals.filter((p) => {
    const matchSearch =
      search === "" ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-8">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            {t("proposals")}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {proposals.length} {t("total").toLowerCase()}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/proposal/new">
            <Plus className="h-3.5 w-3.5" />
            {t("new_proposal")}
          </Link>
        </Button>
      </div>

      {/* ── Stat strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 overflow-hidden rounded-xl border border-zinc-800 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800">
        {STAT_DEFS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() =>
              setStatusFilter(key === "total" ? "all" : (key as ProposalStatus))
            }
            className={cn(
              "group flex flex-col gap-1 px-5 py-4 text-left transition-colors hover:bg-zinc-900/50",
              (statusFilter === key || (key === "total" && statusFilter === "all")) &&
                "bg-zinc-900/60"
            )}
          >
            <p className="text-xs font-medium text-zinc-500">{t(key)}</p>
            <p className="text-2xl font-semibold tabular-nums text-zinc-100">
              {stats[key]}
            </p>
          </button>
        ))}
      </div>

      {/* ── Search + filter ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <Input
            placeholder={t("search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Segmented filter */}
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
          {STATUS_FILTERS.map(({ value }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === value
                  ? "bg-zinc-700 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {t(value)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Proposals list ────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-20 text-center">
          <FileText className="h-8 w-8 text-zinc-700 mb-3" />
          <p className="text-sm font-medium text-zinc-400">{t("no_proposals_found")}</p>
          <p className="mt-1 text-xs text-zinc-600">
            {search || statusFilter !== "all"
              ? t("adjust_search")
              : t("create_first_proposal")}
          </p>
          {!search && statusFilter === "all" && (
            <Button className="mt-5" asChild size="sm" variant="outline">
              <Link href="/proposal/new">
                <Plus className="h-3.5 w-3.5" />
                {t("new_proposal")}
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-zinc-800 px-5 py-2.5">
            <p className="text-xs font-medium text-zinc-500">{t("proposal")}</p>
            <p className="hidden text-xs font-medium text-zinc-500 sm:block text-right">
              {t("amount")}
            </p>
            <div className="w-8" />
          </div>

          {/* Rows */}
          <div className="divide-y divide-zinc-800/60">
            {filtered.map((proposal) => {
              const total = proposalTotal(proposal.items);
              return (
                <div
                  key={proposal.id}
                  className="group grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 cursor-pointer hover:bg-zinc-900/40 transition-colors"
                  onClick={() => router.push(`/proposal/${proposal.id}`)}
                >
                  {/* Left: title + meta */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Status dot */}
                    <div
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        STATUS_DOT[proposal.status]
                      )}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-zinc-100 group-hover:text-white transition-colors">
                          {proposal.title}
                        </p>
                        <span
                          className={cn(
                            "hidden sm:inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                            STATUS_BADGE[proposal.status]
                          )}
                        >
                          {t(proposal.status)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {proposal.client}
                        <span className="mx-1.5 text-zinc-700">·</span>
                        {proposal.items.length}{" "}
                        {proposal.items.length === 1 ? t("item") : t("items")}
                        <span className="mx-1.5 text-zinc-700 hidden sm:inline">
                          ·
                        </span>
                        <span className="hidden sm:inline">
                          {proposal.updatedAt}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Amount */}
                  <p className="hidden text-sm font-medium tabular-nums text-zinc-300 sm:block text-right font-mono">
                    {formatCurrency(total)}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/proposal/${proposal.id}`);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t("view")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/proposal/${proposal.id}/edit`);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-400 focus:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProposal(proposal.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
