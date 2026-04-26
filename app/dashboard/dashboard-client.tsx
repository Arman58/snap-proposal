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
  Columns2,
  ChevronUp,
  ChevronDown,
  X,
  Copy,
  ImageIcon,
  Link2,
  Sparkles,
} from "lucide-react";
import { toast } from "@/components/ui/toaster";
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

const STATUS_BADGE: Record<ProposalStatus, string> = {
  draft: "bg-zinc-800 text-zinc-400",
  sent: "bg-blue-900/50 text-blue-300",
  accepted: "bg-emerald-900/50 text-emerald-300",
  declined: "bg-red-900/50 text-red-300",
};

// ─── Column Manager ───────────────────────────────────────────────────────────

const COLUMN_STORAGE_KEY = "proposal-table-columns-v1";

/** Built-in dashboard column id → i18n key for display (custom columns use stored label). */
const DASHBOARD_COL_T_KEYS: Record<string, string> = {
  title: "proposal",
  status: "proposal_status",
  client: "proposal_client",
  items: "table_col_items_header",
  date: "proposal_date",
  amount: "amount",
  actions: "actions",
  image: "col_image",
};

type ColumnDef = {
  id: string;
  label: string;
  visible: boolean;
  order: number;
};

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: "title",   label: "Proposal", visible: true, order: 0 },
  { id: "status",  label: "Status",   visible: true, order: 1 },
  { id: "client",  label: "Client",   visible: true, order: 2 },
  { id: "items",   label: "Items",    visible: true, order: 3 },
  { id: "date",    label: "Date",     visible: true, order: 4 },
  { id: "amount",  label: "Amount",   visible: true, order: 5 },
  { id: "actions", label: "Actions",  visible: true, order: 6 },
  { id: "image",   label: "Image",    visible: true, order: 1000 },
];

function loadColumns(): ColumnDef[] {
  if (typeof window === "undefined") return DEFAULT_COLUMNS;
  try {
    const raw = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed: ColumnDef[] = JSON.parse(raw);
    // Merge with defaults so newly-added columns always appear
    const byId = new Map(parsed.map((c) => [c.id, c]));
    const merged = DEFAULT_COLUMNS.map((def) => byId.get(def.id) ?? def);
    // Preserve custom columns (id prefix "custom_") that aren't in DEFAULT_COLUMNS
    const customCols = parsed.filter((c) => c.id.startsWith("custom_"));
    return [...merged, ...customCols].sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function saveColumns(cols: ColumnDef[]) {
  try {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(cols));
  } catch {}
}

function useColumnManager() {
  const [columns, setColumns] = useState<ColumnDef[]>(loadColumns);

  function toggleColumn(id: string) {
    setColumns((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c));
      saveColumns(next);
      return next;
    });
  }

  function moveColumn(id: string, direction: "up" | "down") {
    setColumns((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = prev.map((c, i) => {
        if (i === idx)   return { ...c, order: prev[swap].order };
        if (i === swap)  return { ...c, order: prev[idx].order };
        return c;
      });
      next.sort((a, b) => a.order - b.order);
      saveColumns(next);
      return next;
    });
  }

  function addColumn(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    setColumns((prev) => {
      const maxOrder = prev.reduce((m, c) => Math.max(m, c.order), -1);
      const next = [
        ...prev,
        { id: `custom_${Date.now()}`, label: trimmed, visible: true, order: maxOrder + 1 },
      ];
      saveColumns(next);
      return next;
    });
  }

  function removeColumn(id: string) {
    setColumns((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveColumns(next);
      return next;
    });
  }

  function isVisible(id: string) {
    return columns.find((c) => c.id === id)?.visible ?? true;
  }

  return { columns, toggleColumn, moveColumn, addColumn, removeColumn, isVisible };
}

// ─── Custom column values ─────────────────────────────────────────────────────

const CUSTOM_VALUES_KEY = "proposal-custom-col-values-v1";

type CustomValues = Record<string, Record<string, string>>; // proposalId → colId → value

function loadCustomValues(): CustomValues {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CUSTOM_VALUES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function useCustomValues() {
  const [values, setValues] = useState<CustomValues>(loadCustomValues);

  function getValue(proposalId: string, colId: string): string {
    return values[proposalId]?.[colId] ?? "";
  }

  function setValue(proposalId: string, colId: string, value: string) {
    setValues((prev) => {
      const next = {
        ...prev,
        [proposalId]: { ...prev[proposalId], [colId]: value },
      };
      try {
        localStorage.setItem(CUSTOM_VALUES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function copyRow(fromId: string, toId: string) {
    setValues((prev) => {
      if (!prev[fromId]) return prev;
      const next = { ...prev, [toId]: { ...prev[fromId] } };
      try { localStorage.setItem(CUSTOM_VALUES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  return { getValue, setValue, copyRow };
}

// ─── Row images ───────────────────────────────────────────────────────────────

const IMAGES_KEY = "proposal-row-images-v1";

function loadRowImages(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(IMAGES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function useRowImages() {
  const [images, setImages] = useState<Record<string, string>>(loadRowImages);

  function getImage(id: string) {
    return images[id] ?? "";
  }

  function setImage(id: string, base64: string) {
    setImages((prev) => {
      const next = { ...prev, [id]: base64 };
      try { localStorage.setItem(IMAGES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function copyImage(fromId: string, toId: string) {
    setImages((prev) => {
      if (!prev[fromId]) return prev;
      const next = { ...prev, [toId]: prev[fromId] };
      try { localStorage.setItem(IMAGES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  return { getImage, setImage, copyImage };
}

// ─── ColumnManagerDropdown ────────────────────────────────────────────────────

function ColumnManagerDropdown({
  columns,
  onToggle,
  onMove,
  onAdd,
  onRemove,
}: {
  columns: ColumnDef[];
  onToggle: (id: string) => void;
  onMove: (id: string, dir: "up" | "down") => void;
  onAdd: (label: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");

  function columnLabel(col: ColumnDef): string {
    const key = DASHBOARD_COL_T_KEYS[col.id];
    return key ? t(key) : col.label;
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    onAdd(name);
    setNewName("");
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen((o) => !o)}
      >
        <Columns2 className="h-3.5 w-3.5" />
        {t("columns")}
      </Button>

      {open && (
        <>
          {/* Backdrop – closes dropdown on outside click */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full z-20 mt-1.5 w-56 rounded-xl border border-zinc-800 bg-zinc-950 py-1 shadow-xl">
            {/* Column list */}
            {columns.map((col, idx) => (
              <div
                key={col.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-900/60"
              >
                <input
                  type="checkbox"
                  id={`col-vis-${col.id}`}
                  checked={col.visible}
                  onChange={() => onToggle(col.id)}
                  className="h-3.5 w-3.5 cursor-pointer accent-blue-500"
                />
                <label
                  htmlFor={`col-vis-${col.id}`}
                  className="flex-1 cursor-pointer select-none text-xs text-zinc-300 truncate"
                >
                  {columnLabel(col)}
                </label>
                {/* Up / down */}
                <div className="flex flex-col">
                  <button
                    onClick={() => onMove(col.id, "up")}
                    disabled={idx === 0}
                    className="text-zinc-600 hover:text-zinc-300 disabled:pointer-events-none disabled:opacity-25"
                    aria-label={t("move_up")}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onMove(col.id, "down")}
                    disabled={idx === columns.length - 1}
                    className="text-zinc-600 hover:text-zinc-300 disabled:pointer-events-none disabled:opacity-25"
                    aria-label={t("move_down")}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                {/* Delete — custom columns only */}
                {col.id.startsWith("custom_") && (
                  <button
                    onClick={() => onRemove(col.id)}
                    className="ml-0.5 text-zinc-700 hover:text-red-400 transition-colors"
                    aria-label={t("remove_column")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Add column footer */}
            <div className="mt-1 border-t border-zinc-800 px-3 pt-2 pb-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder={t("column_name_placeholder")}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
                />
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim()}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-30 transition-colors"
                  aria-label={t("add_column")}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Relative date ────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr: string, t: (key: string) => string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return t("relative_today");
  if (days === 1) return t("relative_yesterday");
  if (days < 7) return t("relative_days_ago").replace("{n}", String(days));
  if (days < 30) return t("relative_weeks_ago").replace("{n}", String(Math.floor(days / 7)));
  if (days < 365) return t("relative_months_ago").replace("{n}", String(Math.floor(days / 30)));
  return t("relative_years_ago").replace("{n}", String(Math.floor(days / 365)));
}

// ─── Stat keys ────────────────────────────────────────────────────────────────

const STAT_DEF_KEYS = ["total", "draft", "sent", "accepted"] as const;

const STATUS_FILTER_VALUES: Array<ProposalStatus | "all"> = [
  "all", "draft", "sent", "accepted", "declined",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardClient() {
  const router = useRouter();
  const { proposals, addProposal, deleteProposal } = useProposalsStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "all">("all");
  const t = useT();
  const { columns, toggleColumn, moveColumn, addColumn, removeColumn, isVisible } = useColumnManager();
  const customValues = useCustomValues();
  const rowImages = useRowImages();

  // Custom column ids are dynamic; the rest are fixed sets
  const CELL_COL_IDS = new Set(["status", "client", "items", "date"]);
  const TOP_COL_IDS = new Set([
    "title", "amount", "actions",
    ...columns.filter((c) => c.id.startsWith("custom_")).map((c) => c.id),
  ]);

  const visibleTopCols = columns
    .filter((c) => TOP_COL_IDS.has(c.id) && c.visible)
    .sort((a, b) => a.order - b.order);

  const visibleCellCols = columns
    .filter((c) => CELL_COL_IDS.has(c.id) && c.visible)
    .sort((a, b) => a.order - b.order);

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: visibleTopCols
      .map((c) => {
        if (c.id === "title") return "1fr";
        if (c.id.startsWith("custom_")) return "120px";
        return "auto";
      })
      .join(" "),
  };

  const stats = {
    total: proposals.length,
    draft: proposals.filter((p) => p.status === "draft").length,
    sent: proposals.filter((p) => p.status === "sent").length,
    accepted: proposals.filter((p) => p.status === "accepted").length,
    declined: proposals.filter((p) => p.status === "declined").length,
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
        {STAT_DEF_KEYS.map((key) => (
          <button
            key={key}
            onClick={() =>
              setStatusFilter(key === "total" ? "all" : (key as ProposalStatus))
            }
            className="group flex flex-col gap-1 px-5 py-4 text-left transition-colors hover:bg-zinc-900/50"
            style={
              statusFilter === key || (key === "total" && statusFilter === "all")
                ? { borderBottomWidth: 2, borderBottomStyle: "solid", borderBottomColor: "var(--theme-color)" }
                : {}
            }
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
          {STATUS_FILTER_VALUES.map((value) => {
            const count = value === "all" ? stats.total : stats[value as keyof typeof stats] ?? 0;
            return (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  statusFilter === value
                    ? "text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
                style={statusFilter === value ? { backgroundColor: "var(--theme-color)" } : {}}
              >
                {t(value)}
                <span
                  className={cn(
                    "tabular-nums",
                    statusFilter === value ? "text-white/70" : "text-zinc-700"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Column manager */}
        <ColumnManagerDropdown
          columns={columns}
          onToggle={toggleColumn}
          onMove={moveColumn}
          onAdd={addColumn}
          onRemove={removeColumn}
        />
      </div>

      {/* ── Proposals list ────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-24 text-center">
          <div className="relative mb-5">
            <div className="h-14 w-14 rounded-2xl border border-zinc-800 bg-zinc-900 flex items-center justify-center">
              {search || statusFilter !== "all" ? (
                <Search className="h-6 w-6 text-zinc-600" />
              ) : (
                <Sparkles className="h-6 w-6 text-zinc-600" />
              )}
            </div>
            {!search && statusFilter === "all" && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-600 opacity-40" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-zinc-700 border border-zinc-600" />
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-zinc-300">{t("no_proposals_found")}</p>
          <p className="mt-1.5 text-xs text-zinc-600 max-w-[200px] leading-relaxed">
            {search || statusFilter !== "all"
              ? t("adjust_search")
              : t("create_first_proposal")}
          </p>
          {!search && statusFilter === "all" && (
            <Button className="mt-6" asChild size="sm">
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
          <div
            className="grid items-center gap-4 border-b border-zinc-800 px-5 py-2.5"
            style={gridStyle}
          >
            <p className="text-xs font-medium text-zinc-500">{t("proposal")}</p>
            {visibleTopCols.slice(1).map((col) => {
              if (col.id === "amount")
                return (
                  <p key="amount" className="text-xs font-medium text-zinc-500 text-right">
                    {t("amount")}
                  </p>
                );
              if (col.id === "actions") return <div key="actions" className="w-8" />;
              if (col.id.startsWith("custom_"))
                return (
                  <p key={col.id} className="text-xs font-medium text-zinc-500 truncate">
                    {col.label}
                  </p>
                );
              return null;
            })}
          </div>

          {/* Rows */}
          <div className="divide-y divide-zinc-800/60">
            {filtered.map((proposal, rowIdx) => {
              const total = proposalTotal(proposal.items);
              return (
                <div
                  key={proposal.id}
                  className="group grid items-center gap-4 px-5 py-4 cursor-pointer hover:bg-zinc-900/40 transition-colors animate-row-in"
                  style={{ ...gridStyle, animationDelay: `${rowIdx * 30}ms` }}
                  onClick={() => router.push(`/proposal/${proposal.id}`)}
                >
                  {/* Left: title + meta (always visible) */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Product image thumbnail / upload */}
                    {isVisible("image") && (() => {
                      const src = rowImages.getImage(proposal.id);
                      return (
                        <div
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="cursor-pointer block">
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () =>
                                  rowImages.setImage(proposal.id, reader.result as string);
                                reader.readAsDataURL(file);
                              }}
                            />
                            {src ? (
                              <img
                                src={src}
                                alt=""
                                className="h-8 w-8 rounded-md object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-md border border-dashed border-zinc-800 flex items-center justify-center text-zinc-700 hover:border-zinc-600 hover:text-zinc-500 transition-colors">
                                <ImageIcon className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </label>
                        </div>
                      );
                    })()}

                    {/* Status dot — always shown as a visual anchor */}
                    <div
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        STATUS_DOT[proposal.status]
                      )}
                    />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-100 group-hover:text-white transition-colors">
                        {proposal.title}
                      </p>

                      {/* Meta line: in-cell columns rendered in user-defined order */}
                      {visibleCellCols.length > 0 && (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-zinc-500">
                          {visibleCellCols.map((col, i) => (
                            <span key={col.id} className="flex items-center gap-x-1">
                              {i > 0 && (
                                <span className="text-zinc-700">·</span>
                              )}
                              {col.id === "status" && (
                                <span
                                  className={cn(
                                    "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                                    STATUS_BADGE[proposal.status]
                                  )}
                                >
                                  {t(proposal.status)}
                                </span>
                              )}
                              {col.id === "client" && proposal.client}
                              {col.id === "items" && (
                                <>
                                  {proposal.items.length}{" "}
                                  {proposal.items.length === 1 ? t("item") : t("items")}
                                </>
                              )}
                              {col.id === "date" && formatRelativeDate(proposal.updatedAt, t)}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Remaining top-level columns in user-defined order */}
                  {visibleTopCols.slice(1).map((col) => {
                    if (col.id.startsWith("custom_"))
                      return (
                        <div
                          key={col.id}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={customValues.getValue(proposal.id, col.id)}
                            onChange={(e) =>
                              customValues.setValue(proposal.id, col.id, e.target.value)
                            }
                            placeholder={t("placeholder_dash")}
                            className="w-full bg-transparent text-xs text-zinc-300 placeholder:text-zinc-700 outline-none border-b border-transparent focus:border-zinc-700 py-0.5 transition-colors"
                          />
                        </div>
                      );
                    if (col.id === "amount")
                      return (
                        <p
                          key="amount"
                          className="text-sm font-medium tabular-nums text-zinc-300 text-right font-mono"
                        >
                          {formatCurrency(total)}
                        </p>
                      );
                    if (col.id === "actions")
                      return (
                        <div key="actions" className="flex items-center justify-end gap-0.5">
                          {/* Quick-action buttons on hover */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/proposal/${proposal.id}`);
                            }}
                            title={t("view")}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/proposal/${proposal.id}/edit`);
                            }}
                            title={t("edit")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
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
                                  const url = `${window.location.origin}/proposal/${proposal.id}`;
                                  navigator.clipboard
                                    .writeText(url)
                                    .then(() => toast(t("link_copied")))
                                    .catch(() => toast(t("copy_link_failed")));
                                }}
                              >
                                <Link2 className="h-3.5 w-3.5" />
                                {t("share")}
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
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newId = `${Date.now()}`;
                                  const today = new Date().toISOString().split("T")[0];
                                  addProposal({
                                    ...proposal,
                                    id: newId,
                                    title: `${t("copy_of_prefix")}${proposal.title}`,
                                    status: "draft",
                                    createdAt: today,
                                    updatedAt: today,
                                  });
                                  customValues.copyRow(proposal.id, newId);
                                  rowImages.copyImage(proposal.id, newId);
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                                {t("duplicate")}
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
                      );
                    return null;
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
