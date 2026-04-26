"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Check,
  X,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  ImageIcon,
  Settings2,
  GripVertical,
  Copy,
  ChevronRight,
  Keyboard,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import Link from "next/link";
import { nanoid } from "@/lib/nanoid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProposalsStore,
  proposalTotal,
  formatWithCurrency,
  DEFAULT_DISPLAY_SETTINGS,
  type LineItem,
  type CustomColumn,
  type Proposal,
  type ProposalStatus,
  type Currency,
  type DisplaySettings,
  type DocumentFont,
} from "@/store/proposals";
import { ProposalDocument } from "./proposal-document";
import { useI18n, useT } from "@/lib/i18n";
import { useProposalImage } from "@/lib/use-proposal-image";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

const BUILDER_DRAFT_VERSION = 1;
const SYNC_THEME_KEY = "snap-sync-theme-accent";
const THEME_COLOR_KEY = "app-theme-color";

const PREVIEW_PANEL_STORAGE_KEY = "snap-preview-panel-v1";
const CATALOG_OPEN_KEY = "snap-catalog-open-v1";
const USER_CATALOG_KEY = "snap-user-catalog-v1"; // MO-6: user-saved catalog items

// QW-10 / VH-04: colored left-border on status select (Von Restorff Effect)
const STATUS_HEX: Record<string, string> = {
  draft: "#71717a",
  sent: "#60a5fa",
  accepted: "#34d399",
  declined: "#f87171",
};
const DEFAULT_PREVIEW_WIDTH = 360;
const PREVIEW_PANEL_MARGIN = 20;
const MIN_PREVIEW_WIDTH = 280;
const MAX_PREVIEW_WIDTH_CAP = 900;
const MIN_PREVIEW_HEIGHT = 200;
const DEFAULT_PREVIEW_MAX_HEIGHT = 90;

function maxPreviewWidthForViewport(vw: number) {
  return Math.min(MAX_PREVIEW_WIDTH_CAP, Math.max(MIN_PREVIEW_WIDTH, vw - 24));
}

function maxPreviewHeightForViewport(vh: number) {
  return Math.max(MIN_PREVIEW_HEIGHT, vh - DEFAULT_PREVIEW_MAX_HEIGHT);
}

type PreviewPanelLayout = { left: number; top: number; width: number; height: number };

function clampPreviewLayout(p: PreviewPanelLayout): PreviewPanelLayout {
  const margin = PREVIEW_PANEL_MARGIN;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const maxH = maxPreviewHeightForViewport(vh);
  const maxW = maxPreviewWidthForViewport(vw);
  let width = Math.min(Math.max(p.width, MIN_PREVIEW_WIDTH), maxW);
  let height = Math.min(Math.max(p.height, MIN_PREVIEW_HEIGHT), maxH);
  let left = p.left;
  let top = p.top;
  if (left + width > vw - margin) left = Math.max(margin, vw - width - margin);
  if (left < margin) left = margin;
  if (left + width > vw - margin) width = Math.max(MIN_PREVIEW_WIDTH, vw - margin - left);
  if (top + height > vh - margin) top = Math.max(margin, vh - height - margin);
  if (top < margin) top = margin;
  if (top + height > vh - margin) height = Math.max(MIN_PREVIEW_HEIGHT, vh - margin - top);
  if (height > maxH) height = maxH;
  return { left, top, width, height };
}

/** Parsed from storage; `height` may be missing in legacy snapshots. */
function parsePreviewLayout(
  raw: string | null
): { left: number; top: number; width: number; height?: number } | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof p.left === "number" &&
      typeof p.top === "number" &&
      typeof p.width === "number" &&
      Number.isFinite(p.left) &&
      Number.isFinite(p.top) &&
      Number.isFinite(p.width)
    ) {
      const height =
        typeof p.height === "number" && Number.isFinite(p.height) ? p.height : undefined;
      return { left: p.left, top: p.top, width: p.width, height };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function builderFormSnapshot(p: {
  title: string;
  company: string;
  companyEmail: string;
  companyPhone: string;
  client: string;
  clientEmail: string;
  clientCompany: string;
  clientPhone: string;
  notes: string;
  showNotes: boolean;
  status: ProposalStatus;
  displaySettings: DisplaySettings;
  items: LineItem[];
  customColumns: CustomColumn[];
  columnConfigs: ColumnConfig[];
}) {
  return JSON.stringify(p);
}

// ─── i18n key maps for FIXED_COLS ─────────────────────────────────────────────

const FIXED_COL_LABEL_KEYS: Record<FixedColKey, string> = {
  imageUrl: "col_image",
  name: "col_product_service",
  description: "col_description",
  qty: "col_qty",
  unit: "col_unit",
  unitPrice: "col_unit_price",
  deliveryTime: "col_delivery_time",
};

const FIXED_COL_PLACEHOLDER_KEYS: Partial<Record<FixedColKey, string>> = {
  name: "col_name_placeholder",
  description: "col_description_placeholder",
  unit: "col_unit_placeholder",
  deliveryTime: "col_delivery_time_placeholder",
};

/** Map fixed column id → i18n key for labels in the column manager. */
const BUILDER_FIXED_COL_T: Record<string, string> = {
  imageUrl: "col_image",
  name: "col_product_service",
  description: "col_description",
  qty: "col_qty",
  unit: "col_unit",
  unitPrice: "col_unit_price",
  deliveryTime: "col_delivery_time",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type FixedColKey = "imageUrl" | "name" | "description" | "qty" | "unit" | "unitPrice" | "deliveryTime";

interface FixedColConfig {
  key: FixedColKey;
  label: string;
  thClass: string;
  inputType: "text" | "number";
  align: "left" | "right";
  placeholder?: string;
}

/** Column visibility / order entry managed by the Column Manager. */
export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  /** When true the visibility checkbox is disabled — column cannot be hidden. */
  alwaysVisible?: boolean;
}

// ─── Fixed column definitions ─────────────────────────────────────────────────

const FIXED_COLS: FixedColConfig[] = [
  {
    key: "imageUrl",
    label: "Image",
    thClass: "w-20",
    inputType: "text",
    align: "left",
  },
  {
    key: "name",
    label: "Product / Service",
    thClass: "min-w-[180px]",
    inputType: "text",
    align: "left",
    placeholder: "e.g. LED Panel 60x60cm",
  },
  {
    key: "description",
    label: "Description",
    thClass: "min-w-[150px]",
    inputType: "text",
    align: "left",
    placeholder: "Optional detail",
  },
  {
    key: "qty",
    label: "Qty",
    thClass: "w-16",
    inputType: "number",
    align: "right",
  },
  {
    key: "unit",
    label: "Unit",
    thClass: "w-20",
    inputType: "text",
    align: "left",
    placeholder: "шт",
  },
  {
    key: "unitPrice",
    label: "Price",
    thClass: "w-24",
    inputType: "number",
    align: "right",
  },
  {
    key: "deliveryTime",
    label: "Delivery Time",
    thClass: "min-w-[120px]",
    inputType: "text",
    align: "left",
    placeholder: "e.g. 3–5 days",
  },
];

/** Fast lookup: column id → FixedColConfig */
const FIXED_COL_MAP = new Map<string, FixedColConfig>(
  FIXED_COLS.map((c) => [c.key, c])
);

/** Unit dropdown options for the unit column. */
const UNIT_OPTIONS = ["шт", "м", "м.п.", "м²", "кг", "л", "компл.", "услуг.", "—"];

// ─── MO-6: User catalog (localStorage-backed) ─────────────────────────────────
interface UserCatalogItem {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
}
function loadUserCatalog(): UserCatalogItem[] {
  try {
    const raw = localStorage.getItem(USER_CATALOG_KEY);
    return raw ? (JSON.parse(raw) as UserCatalogItem[]) : [];
  } catch {
    return [];
  }
}
function persistUserCatalog(items: UserCatalogItem[]) {
  try { localStorage.setItem(USER_CATALOG_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

// ─── Column Manager: defaults + localStorage helpers ──────────────────────────

const COL_STORAGE_KEY = "snap-proposal-col-configs";

const DEFAULT_FIXED_COL_CONFIGS: ColumnConfig[] = [
  { id: "imageUrl",      label: "Image",             visible: true,  order: 0 },
  { id: "name",          label: "Product / Service", visible: true,  order: 1, alwaysVisible: true },
  { id: "description",   label: "Description",       visible: true,  order: 2 },
  { id: "qty",           label: "Qty",               visible: true,  order: 3 },
  { id: "unit",          label: "Unit",              visible: true,  order: 4 }, // QW-3: units are mission-critical
  { id: "unitPrice",     label: "Price",             visible: true,  order: 5, alwaysVisible: true },
  { id: "deliveryTime",  label: "Delivery Time",     visible: true,  order: 6 },
];

/**
 * Build initial column configs by merging localStorage preferences (if any)
 * with the fixed defaults and the current custom columns.
 */
/** Default column layout only — no `localStorage` (must match server render for hydration). */
function buildDefaultColumnConfigs(customColumns: CustomColumn[]): ColumnConfig[] {
  const fixedConfigs: ColumnConfig[] = DEFAULT_FIXED_COL_CONFIGS.map((def) => ({ ...def }));
  const maxFixedOrder = Math.max(...fixedConfigs.map((c) => c.order), 0);
  const customConfigs: ColumnConfig[] = customColumns.map((col, i) => ({
    id: col.id,
    label: col.label,
    visible: true,
    order: maxFixedOrder + 1 + i,
  }));
  return [...fixedConfigs, ...customConfigs];
}

/** Merges `localStorage` column prefs. Call from `useEffect` on the client only. */
function buildInitialColumnConfigs(customColumns: CustomColumn[]): ColumnConfig[] {
  let stored: ColumnConfig[] = [];
  try {
    const raw = localStorage.getItem(COL_STORAGE_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    // ignore corrupted storage
  }

  // Merge stored user prefs onto fixed column defaults
  const fixedConfigs: ColumnConfig[] = DEFAULT_FIXED_COL_CONFIGS.map((def) => {
    const s = stored.find((c) => c.id === def.id);
    return s ? { ...def, visible: s.visible, order: s.order } : { ...def };
  });

  const maxFixedOrder = Math.max(...fixedConfigs.map((c) => c.order), 0);

  // Restore custom column prefs or create fresh entries
  const customConfigs: ColumnConfig[] = customColumns.map((col, i) => {
    const s = stored.find((c) => c.id === col.id);
    return s
      ? { ...s, label: col.label } // keep prefs, refresh label in case renamed
      : { id: col.id, label: col.label, visible: true, order: maxFixedOrder + 1 + i };
  });

  return [...fixedConfigs, ...customConfigs];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyItem(customColumns: CustomColumn[]): LineItem {
  const attrs: Record<string, string> = {};
  customColumns.forEach((c) => (attrs[c.id] = ""));
  return {
    id: nanoid(),
    name: "",
    description: "",
    qty: 1,
    unit: "шт",
    unitPrice: 0,
    imageUrl: "",
    deliveryTime: "",
    attrs,
  };
}

// ─── Column Manager Dropdown ──────────────────────────────────────────────────

interface ColumnManagerDropdownProps {
  configs: ColumnConfig[];
  onChange: (configs: ColumnConfig[]) => void;
  onAddColumn: (label: string) => void;
}

function ColumnManagerDropdown({ configs, onChange, onAddColumn }: ColumnManagerDropdownProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Add Column modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newColLabel, setNewColLabel] = useState("");
  const [newColError, setNewColError] = useState("");

  const sorted = [...configs].sort((a, b) => a.order - b.order);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function openAddModal() {
    setNewColLabel("");
    setNewColError("");
    setOpen(false);      // close the dropdown first
    setAddModalOpen(true);
  }

  function closeAddModal() {
    setAddModalOpen(false);
    setNewColLabel("");
    setNewColError("");
  }

  function handleAddColumn() {
    const label = newColLabel.trim();
    if (!label) {
      setNewColError(t("column_name_required"));
      return;
    }
    onAddColumn(label);
    closeAddModal();
  }

  function toggleVisible(id: string) {
    onChange(configs.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  }

  function move(id: string, direction: -1 | 1) {
    const s = [...configs].sort((a, b) => a.order - b.order);
    const idx = s.findIndex((c) => c.id === id);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= s.length) return;
    const aOrder = s[idx].order;
    const bOrder = s[targetIdx].order;
    onChange(
      configs.map((c) => {
        if (c.id === s[idx].id) return { ...c, order: bOrder };
        if (c.id === s[targetIdx].id) return { ...c, order: aOrder };
        return c;
      })
    );
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className={`h-8 px-2.5 text-xs font-medium transition-colors ${
          open ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"
        }`}
      >
        {t("columns")}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-3 pt-2.5 pb-1.5 border-b border-zinc-800">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("manage_columns")}
            </p>
          </div>

          {/* Column list */}
          <div className="px-1.5 py-1.5 max-h-72 overflow-y-auto">
            {sorted.map((col, idx) => (
              <div
                key={col.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-800/60 transition-colors"
              >
                {/* Visibility checkbox */}
                <input
                  type="checkbox"
                  id={`colmgr-${col.id}`}
                  checked={col.visible}
                  disabled={col.alwaysVisible}
                  onChange={() => toggleVisible(col.id)}
                  className="h-3.5 w-3.5 accent-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 shrink-0"
                />

                {/* Label */}
                <label
                  htmlFor={`colmgr-${col.id}`}
                  className={`flex-1 text-sm leading-none select-none ${
                    col.alwaysVisible
                      ? "cursor-not-allowed text-zinc-500"
                      : "cursor-pointer text-zinc-200"
                  }`}
                >
                  {BUILDER_FIXED_COL_T[col.id] ? t(BUILDER_FIXED_COL_T[col.id]) : col.label}
                  {col.alwaysVisible && (
                    <span className="ml-1.5 text-[10px] text-zinc-600">{t("column_required_badge")}</span>
                  )}
                </label>

                {/* Up / Down reorder buttons */}
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => move(col.id, -1)}
                    disabled={idx === 0}
                    className="rounded p-0.5 text-zinc-600 hover:text-zinc-200 disabled:opacity-0 disabled:pointer-events-none transition-colors"
                    title={t("move_up")}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => move(col.id, 1)}
                    disabled={idx === sorted.length - 1}
                    className="rounded p-0.5 text-zinc-600 hover:text-zinc-200 disabled:opacity-0 disabled:pointer-events-none transition-colors"
                    title={t("move_down")}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer — Add column */}
          <div className="border-t border-zinc-800 px-1.5 py-1.5">
            <button
              onClick={openAddModal}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("add_column")}
            </button>
          </div>
        </div>
      )}

      {/* ── Add Column Dialog ────────────────────────────────────────────── */}
      <Dialog open={addModalOpen} onOpenChange={(open) => { if (!open) closeAddModal(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("add_column_title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="new-col-name" className="text-sm text-zinc-300">
                {t("column_name_label")}
              </Label>
              <Input
                id="new-col-name"
                placeholder={t("new_column_placeholder")}
                value={newColLabel}
                autoFocus
                onChange={(e) => {
                  setNewColLabel(e.target.value);
                  if (newColError) setNewColError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddColumn();
                  if (e.key === "Escape") closeAddModal();
                }}
                className={newColError ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {newColError && (
                <p className="text-xs text-red-400">{newColError}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={closeAddModal}>
              {t("cancel")}
            </Button>
            <Button size="sm" onClick={handleAddColumn}>
              {t("add_column")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Final Settings Dropdown (MO-2: split into Document / Style tabs) ────────
// Miller's Law: max 7 items per tab. Two tabs × ≤7 items each vs previous 14+ in one scroll.

interface FinalSettingsDropdownProps {
  settings: DisplaySettings;
  onChange: (s: DisplaySettings) => void;
  syncThemeAccent: boolean;
  onSyncThemeAccentChange: (v: boolean) => void;
}

function FinalSettingsDropdown({
  settings,
  onChange,
  syncThemeAccent,
  onSyncThemeAccentChange,
}: FinalSettingsDropdownProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"document" | "style">("document");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function toggle(key: keyof Pick<DisplaySettings, "showPrice" | "showTotal" | "showDescription" | "showDeliveryTime">) {
    onChange({ ...settings, [key]: !settings[key] });
  }

  const toggleItems: { key: keyof DisplaySettings; labelKey: string }[] = [
    { key: "showPrice", labelKey: "setting_show_price" },
    { key: "showTotal", labelKey: "setting_show_total" },
    { key: "showDescription", labelKey: "setting_show_description" },
    { key: "showDeliveryTime", labelKey: "setting_show_delivery" },
  ];

  const currencies: Currency[] = ["USD", "RUB", "AMD"];

  // Named color anchors for psychological anchoring (PT-04)
  const COLOR_PRESETS: { hex: string; label: string }[] = [
    { hex: "#18181b", label: "Pro" },
    { hex: "#1e40af", label: "Corp" },
    { hex: "#065f46", label: "Growth" },
    { hex: "#7c3aed", label: "Bold" },
    { hex: "#be123c", label: "Urgent" },
    { hex: "#b45309", label: "Warm" },
    { hex: "#0e7490", label: "Trust" },
    { hex: "#374151", label: "Clean" },
  ];

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className={`h-9 w-9 transition-colors ${
          open ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"
        }`}
        title={t("settings")}
      >
        <Settings2 className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
          {/* Tab bar — role="tablist" for a11y */}
          <div role="tablist" className="flex border-b border-zinc-800">
            {(["document", "style"] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  activeTab === tab
                    ? "text-zinc-100 border-b-2 border-blue-500"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab === "document" ? "Document" : "Style"}
              </button>
            ))}
          </div>

          {/* ── Document tab: content decisions (≤7 items) ── */}
          {activeTab === "document" && (
            <>
              {/* Visibility toggles */}
              <div className="px-1.5 py-1.5 border-b border-zinc-800">
                {toggleItems.map(({ key, labelKey }) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-800/60 transition-colors"
                  >
                    <input
                      type="checkbox"
                      id={`fs-${key}`}
                      checked={settings[key] as boolean}
                      onChange={() => toggle(key as keyof Pick<DisplaySettings, "showPrice" | "showTotal" | "showDescription" | "showDeliveryTime">)}
                      className="h-3.5 w-3.5 accent-blue-500 cursor-pointer shrink-0"
                    />
                    <label htmlFor={`fs-${key}`} className="flex-1 text-sm text-zinc-200 cursor-pointer select-none">
                      {t(labelKey)}
                    </label>
                  </div>
                ))}
              </div>

              {/* Currency */}
              <div className="px-3 py-2 border-b border-zinc-800">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  {t("currency_label")}
                </p>
                <div className="flex gap-1">
                  {currencies.map((c) => (
                    <button
                      key={c}
                      onClick={() => onChange({ ...settings, currency: c })}
                      className={`flex-1 rounded px-1.5 py-1 text-xs font-medium transition-colors ${
                        settings.currency === c
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spacing */}
              <div className="px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  {t("spacing_label")}
                </p>
                <div className="flex gap-1">
                  {(["compact", "comfortable"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => onChange({ ...settings, spacing: s })}
                      className={`flex-1 rounded px-1.5 py-1 text-xs font-medium transition-colors ${
                        settings.spacing === s
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {s === "compact" ? t("spacing_compact") : t("spacing_comfortable")}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Style tab: aesthetics (≤7 items) ── */}
          {activeTab === "style" && (
            <>
              {/* Document font */}
              <div className="px-3 py-2 border-b border-zinc-800">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  {t("document_font")}
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {(["inter", "system", "serif"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => onChange({ ...settings, documentFont: f as DocumentFont })}
                      className={`rounded px-1 py-1.5 text-[10px] font-medium leading-tight transition-colors ${
                        (settings.documentFont ?? "inter") === f
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {f === "inter" && t("font_inter")}
                      {f === "system" && t("font_system")}
                      {f === "serif" && t("font_serif")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent color with named presets (PT-04) */}
              <div className="px-3 py-2 border-b border-zinc-800">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  {t("accent_color")}
                </p>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {COLOR_PRESETS.map(({ hex, label }) => (
                    <label key={hex} className="flex flex-col items-center gap-0.5 cursor-pointer">
                      <button
                        type="button"
                        onClick={() => onChange({ ...settings, accentColor: hex })}
                        title={`${label} — ${hex}`}
                        className="h-6 w-6 rounded-full border-2 transition-all hover:scale-110 focus:outline-none"
                        style={{
                          backgroundColor: hex,
                          borderColor: settings.accentColor === hex ? "white" : "transparent",
                          boxShadow: settings.accentColor === hex ? `0 0 0 2px ${hex}` : undefined,
                        }}
                      />
                      <span className="text-[8px] text-zinc-600 leading-none">{label}</span>
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <span
                    className="h-6 w-6 rounded-full border-2 border-white/20 group-hover:border-white/40 shrink-0 transition-colors"
                    style={{ backgroundColor: settings.accentColor }}
                  />
                  <input
                    type="color"
                    value={settings.accentColor}
                    aria-label="Accent color for this proposal"
                    onChange={(e) => onChange({ ...settings, accentColor: e.target.value })}
                    onInput={(e) => onChange({ ...settings, accentColor: (e.target as HTMLInputElement).value })}
                    className="sr-only"
                  />
                  <span className="text-xs text-zinc-400 font-mono">{settings.accentColor}</span>
                </label>
              </div>

              {/* Sync accent */}
              <div className="px-3 py-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={syncThemeAccent}
                    onChange={(e) => onSyncThemeAccentChange(e.target.checked)}
                    className="h-3.5 w-3.5 accent-blue-500"
                  />
                  <span className="text-xs text-zinc-400">{t("sync_theme_accent")}</span>
                </label>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ProposalBuilderProps {
  initialId?: string;
}

export function ProposalBuilder({ initialId }: ProposalBuilderProps) {
  const router = useRouter();
  const { addProposal, getProposal, updateProposal } = useProposalsStore();

  const existing = initialId ? getProposal(initialId) : undefined;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [company, setCompany] = useState(existing?.company ?? "");
  const [companyEmail, setCompanyEmail] = useState(existing?.companyEmail ?? "");
  const [companyPhone, setCompanyPhone] = useState(existing?.companyPhone ?? "");
  const [client, setClient] = useState(existing?.client ?? "");
  const [clientEmail, setClientEmail] = useState(existing?.clientEmail ?? "");
  const [clientCompany, setClientCompany] = useState(existing?.clientCompany ?? "");
  const [clientPhone, setClientPhone] = useState(existing?.clientPhone ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [showNotes, setShowNotes] = useState(() => Boolean(existing?.notes));
  const [status, setStatus] = useState<ProposalStatus>(
    existing?.status ?? "draft"
  );
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(() => ({
    ...DEFAULT_DISPLAY_SETTINGS,
    ...existing?.displaySettings,
  }));
  const [items, setItems] = useState<LineItem[]>(
    existing?.items.length ? existing.items : [emptyItem([])]
  );
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(
    existing?.customColumns ?? []
  );

  // Column manager: first paint must not read localStorage (SSR vs client mismatch).
  // Prefs are applied in useEffect after mount.
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(() =>
    buildDefaultColumnConfigs(existing?.customColumns ?? [])
  );
  const skipColConfigPersistOnce = useRef(true);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false); // MO-3: post-save "Saved ✓" state
  const [autosaveAt, setAutosaveAt] = useState<Date | null>(null); // MO-7: autosave timestamp
  const [userCatalog, setUserCatalog] = useState<UserCatalogItem[]>([]); // MO-6: user catalog
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set()); // QW-5: animate catalog-added rows
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewLayout, setPreviewLayout] = useState<PreviewPanelLayout | null>(null);
  const previewPanelRef = useRef<HTMLDivElement | null>(null);
  const moveStartRef = useRef({ x: 0, y: 0, left: 0, top: 0, width: 0, height: 0 });
  const [previewDocDate] = useState(
    () => existing?.updatedAt ?? new Date().toISOString().split("T")[0]
  );
  const [showSaveHints, setShowSaveHints] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [syncThemeAccent, setSyncThemeAccent] = useState(false);

  const draftKey = `snap-builder-draft-${initialId ?? "new"}`;
  const lastSavedRef = useRef("");
  const draftHydratedRef = useRef(false);
  const restoredDraftSkipColMerge = useRef(false);
  const [draftReady, setDraftReady] = useState(false);

  const t = useT();
  const { locale } = useI18n();
  const proposalImagePreview = useProposalImage(initialId ?? "");

  const formattedPreviewDate = useMemo(() => {
    const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
    return new Date(previewDocDate + "T12:00:00").toLocaleDateString(dateLocale, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [locale, previewDocDate]);

  const previewAsProposal: Proposal = useMemo(
    () => ({
      id: initialId ?? "0000000000000000",
      title: title || "",
      company,
      companyEmail: companyEmail || undefined,
      companyPhone: companyPhone || undefined,
      client: client || "",
      clientEmail,
      clientCompany: clientCompany || undefined,
      clientPhone: clientPhone || undefined,
      status,
      createdAt: previewDocDate,
      updatedAt: previewDocDate,
      notes: showNotes ? notes : "",
      items,
      customColumns,
      displaySettings,
    }),
    [
      initialId,
      title,
      company,
      companyEmail,
      companyPhone,
      client,
      clientEmail,
      clientCompany,
      clientPhone,
      status,
      previewDocDate,
      showNotes,
      notes,
      items,
      customColumns,
      displaySettings,
    ]
  );

  const isEdit = Boolean(initialId);
  const total = proposalTotal(items);
  const canSave = title.trim() !== "" && client.trim() !== "";
  const hasNamedLineItem = items.some((i) => i.name.trim() !== "");

  // MO-4: Goal-gradient completeness (4 milestones × 25%)
  const completeness = useMemo(() => {
    let score = 0;
    if (title.trim()) score += 25;
    if (client.trim()) score += 25;
    if (items.some((i) => i.name.trim())) score += 25;
    if (items.some((i) => i.unitPrice > 0)) score += 25;
    return score;
  }, [title, client, items]);

  // MO-7: format autosave timestamp as "Xm ago" / "just now"
  const autosaveLabel = useMemo(() => {
    if (!autosaveAt) return null;
    const mins = Math.floor((Date.now() - autosaveAt.getTime()) / 60000);
    return mins < 1 ? "Draft saved" : `Draft saved ${mins}m ago`;
  }, [autosaveAt]);

  const buildSnapshot = useCallback(
    () =>
      builderFormSnapshot({
        title,
        company,
        companyEmail,
        companyPhone,
        client,
        clientEmail,
        clientCompany,
        clientPhone,
        notes,
        showNotes,
        status,
        displaySettings,
        items,
        customColumns,
        columnConfigs,
      }),
    [
      title,
      company,
      companyEmail,
      companyPhone,
      client,
      clientEmail,
      clientCompany,
      clientPhone,
      notes,
      showNotes,
      status,
      displaySettings,
      items,
      customColumns,
      columnConfigs,
    ]
  );

  const isDirty = draftReady && buildSnapshot() !== lastSavedRef.current;

  // Floating live preview: default bottom-right, then localStorage; drag + resize
  useLayoutEffect(() => {
    if (previewLayout !== null) return;
    if (!previewOpen) return;
    const el = previewPanelRef.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    let fromStorage: ReturnType<typeof parsePreviewLayout> = null;
    try {
      fromStorage = parsePreviewLayout(
        localStorage.getItem(PREVIEW_PANEL_STORAGE_KEY)
      );
    } catch {
      /* ignore */
    }
    if (fromStorage) {
      const full: PreviewPanelLayout = {
        left: fromStorage.left,
        top: fromStorage.top,
        width: fromStorage.width,
        height: fromStorage.height ?? h,
      };
      setPreviewLayout(clampPreviewLayout(full));
      return;
    }
    const w = DEFAULT_PREVIEW_WIDTH;
    setPreviewLayout(
      clampPreviewLayout({
        left: window.innerWidth - w - PREVIEW_PANEL_MARGIN,
        top: window.innerHeight - h - PREVIEW_PANEL_MARGIN,
        width: w,
        height: h,
      })
    );
  }, [previewOpen, previewLayout]);

  useEffect(() => {
    if (previewLayout === null) return;
    try {
      localStorage.setItem(
        PREVIEW_PANEL_STORAGE_KEY,
        JSON.stringify(previewLayout)
      );
    } catch {
      /* ignore */
    }
  }, [previewLayout]);

  useEffect(() => {
    function onWinResize() {
      if (!previewPanelRef.current) return;
      setPreviewLayout((prev) => (prev ? clampPreviewLayout(prev) : prev));
    }
    window.addEventListener("resize", onWinResize);
    return () => window.removeEventListener("resize", onWinResize);
  }, []);

  const onPreviewHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (!previewLayout) return;
      e.preventDefault();
      const el = e.currentTarget;
      moveStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        left: previewLayout.left,
        top: previewLayout.top,
        width: previewLayout.width,
        height: previewLayout.height,
      };
      el.setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        const s = moveStartRef.current;
        setPreviewLayout(
          clampPreviewLayout({
            left: s.left + (ev.clientX - s.x),
            top: s.top + (ev.clientY - s.y),
            width: s.width,
            height: s.height,
          })
        );
      };
      const onUp = (ev: PointerEvent) => {
        if (el.hasPointerCapture(ev.pointerId)) {
          el.releasePointerCapture(ev.pointerId);
        }
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [previewLayout]
  );

  const onPreviewResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (!previewLayout) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = previewLayout.width;
      const startLeft = previewLayout.left;
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX;
        // Left-edge handle: right edge of panel stays fixed
        setPreviewLayout((prev) => {
          if (!prev) return null;
          return clampPreviewLayout({
            left: startLeft + delta,
            top: prev.top,
            width: startW - delta,
            height: prev.height,
          });
        });
      };
      const onUp = (ev: PointerEvent) => {
        if (el.hasPointerCapture(ev.pointerId)) {
          el.releasePointerCapture(ev.pointerId);
        }
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [previewLayout]
  );

  const onPreviewHeightResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (!previewLayout) return;
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startH = previewLayout.height;
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientY - startY;
        setPreviewLayout((prev) => {
          if (!prev) return null;
          return clampPreviewLayout({
            left: prev.left,
            top: prev.top,
            width: prev.width,
            height: startH + delta,
          });
        });
      };
      const onUp = (ev: PointerEvent) => {
        if (el.hasPointerCapture(ev.pointerId)) {
          el.releasePointerCapture(ev.pointerId);
        }
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [previewLayout]
  );

  useEffect(() => {
    try {
      setSyncThemeAccent(localStorage.getItem(SYNC_THEME_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CATALOG_OPEN_KEY);
      if (stored !== null) setCatalogOpen(stored === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCatalog() {
    const next = !catalogOpen;
    setCatalogOpen(next);
    try {
      localStorage.setItem(CATALOG_OPEN_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  // MO-6: Load user catalog on mount
  useEffect(() => {
    setUserCatalog(loadUserCatalog());
  }, []);

  // MO-6: Save-to-catalog handler
  const saveToCatalog = useCallback((item: LineItem) => {
    if (!item.name.trim()) return;
    setUserCatalog((prev) => {
      // Avoid exact duplicates (same name + unit + price)
      if (prev.some((c) => c.name === item.name && c.unit === item.unit && c.unitPrice === item.unitPrice)) {
        return prev;
      }
      const next: UserCatalogItem[] = [
        ...prev,
        { id: nanoid(), name: item.name, unit: item.unit, unitPrice: item.unitPrice },
      ];
      persistUserCatalog(next);
      return next;
    });
  }, []);

  const removeFromUserCatalog = useCallback((id: string) => {
    setUserCatalog((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persistUserCatalog(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!syncThemeAccent) return;
    document.documentElement.style.setProperty("--theme-color", displaySettings.accentColor);
    try {
      localStorage.setItem(THEME_COLOR_KEY, displaySettings.accentColor);
    } catch {
      /* ignore */
    }
  }, [displaySettings.accentColor, syncThemeAccent]);

  function persistSyncThemeAccent(v: boolean) {
    setSyncThemeAccent(v);
    try {
      localStorage.setItem(SYNC_THEME_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  // Restore draft once; align dirty baseline
  useLayoutEffect(() => {
    if (draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    const ex = initialId ? getProposal(initialId) : undefined;
    let restored = false;

    type DraftShape = {
      v?: number;
      savedAt?: string;
      title?: string;
      company?: string;
      companyEmail?: string;
      companyPhone?: string;
      client?: string;
      clientEmail?: string;
      clientCompany?: string;
      clientPhone?: string;
      notes?: string;
      showNotes?: boolean;
      status?: ProposalStatus;
      displaySettings?: DisplaySettings;
      items?: LineItem[];
      customColumns?: CustomColumn[];
      columnConfigs?: ColumnConfig[];
    };

    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as DraftShape;
        if (d.v === BUILDER_DRAFT_VERSION && Array.isArray(d.items)) {
          let useDraft = !initialId;
          if (initialId && ex) {
            const draftTs = new Date(d.savedAt || 0).getTime();
            const propTs = new Date(ex.updatedAt).getTime();
            useDraft = draftTs > propTs;
          }
          if (useDraft) {
            restored = true;
            const cols = d.customColumns ?? [];
            const rowItems =
              d.items!.length > 0 ? d.items! : [emptyItem(cols)];
            const configs =
              d.columnConfigs && d.columnConfigs.length > 0
                ? d.columnConfigs
                : buildDefaultColumnConfigs(cols);
            lastSavedRef.current = builderFormSnapshot({
              title: d.title ?? "",
              company: d.company ?? "",
              companyEmail: d.companyEmail ?? "",
              companyPhone: d.companyPhone ?? "",
              client: d.client ?? "",
              clientEmail: d.clientEmail ?? "",
              clientCompany: d.clientCompany ?? "",
              clientPhone: d.clientPhone ?? "",
              notes: d.notes ?? "",
              showNotes: Boolean(d.showNotes ?? d.notes),
              status: d.status ?? "draft",
              displaySettings: {
                ...DEFAULT_DISPLAY_SETTINGS,
                ...d.displaySettings,
              },
              items: rowItems,
              customColumns: cols,
              columnConfigs: configs,
            });
            setTitle(d.title ?? "");
            setCompany(d.company ?? "");
            setCompanyEmail(d.companyEmail ?? "");
            setCompanyPhone(d.companyPhone ?? "");
            setClient(d.client ?? "");
            setClientEmail(d.clientEmail ?? "");
            setClientCompany(d.clientCompany ?? "");
            setClientPhone(d.clientPhone ?? "");
            setNotes(d.notes ?? "");
            setShowNotes(Boolean(d.showNotes ?? d.notes));
            if (d.status) setStatus(d.status);
            if (d.displaySettings)
              setDisplaySettings({
                ...DEFAULT_DISPLAY_SETTINGS,
                ...d.displaySettings,
              });
            setItems(rowItems);
            setCustomColumns(cols);
            if (d.columnConfigs?.length) {
              restoredDraftSkipColMerge.current = true;
              setColumnConfigs(d.columnConfigs);
            }
            queueMicrotask(() => toast(t("draft_restored"), { variant: "default" }));
          }
        }
      }
    } catch {
      /* ignore */
    }

    if (!restored) {
      lastSavedRef.current = builderFormSnapshot({
        title: ex?.title ?? "",
        company: ex?.company ?? "",
        companyEmail: ex?.companyEmail ?? "",
        companyPhone: ex?.companyPhone ?? "",
        client: ex?.client ?? "",
        clientEmail: ex?.clientEmail ?? "",
        clientCompany: ex?.clientCompany ?? "",
        clientPhone: ex?.clientPhone ?? "",
        notes: ex?.notes ?? "",
        showNotes: Boolean(ex?.notes),
        status: ex?.status ?? "draft",
        displaySettings: {
          ...DEFAULT_DISPLAY_SETTINGS,
          ...ex?.displaySettings,
        },
        items: ex?.items?.length ? ex.items : [emptyItem(ex?.customColumns ?? [])],
        customColumns: ex?.customColumns ?? [],
        columnConfigs: buildDefaultColumnConfigs(ex?.customColumns ?? []),
      });
    }

    setDraftReady(true);
  }, [draftKey, initialId, getProposal, t]);

  // Debounced draft autosave
  useEffect(() => {
    if (!draftReady) return;
    const snap = buildSnapshot();
    if (snap === lastSavedRef.current) return;
    const h = window.setTimeout(() => {
      try {
        const parsed = JSON.parse(snap) as Record<string, unknown>;
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            v: BUILDER_DRAFT_VERSION,
            savedAt: new Date().toISOString(),
            ...parsed,
          })
        );
        setAutosaveAt(new Date()); // MO-7: record timestamp for "Draft saved Xm ago"
      } catch {
        /* ignore */
      }
    }, 600);
    return () => window.clearTimeout(h);
  }, [buildSnapshot, draftKey, draftReady]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!draftReady) return;
      if (buildSnapshot() !== lastSavedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [buildSnapshot, draftReady]);

  // Apply `localStorage` after mount, before paint — avoids hydration mismatch and default→storage flash
  useLayoutEffect(() => {
    if (restoredDraftSkipColMerge.current) {
      restoredDraftSkipColMerge.current = false;
      return;
    }
    setColumnConfigs(buildInitialColumnConfigs(customColumns));
  }, [customColumns]);

  // Persist column configs whenever they change (skip first run: that pass still has SSR default)
  useEffect(() => {
    if (skipColConfigPersistOnce.current) {
      skipColConfigPersistOnce.current = false;
      return;
    }
    try {
      localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(columnConfigs));
    } catch {
      // ignore storage errors
    }
  }, [columnConfigs]);

  // ─── Item CRUD ─────────────────────────────────────────────────────────────

  const addItem = useCallback(
    (afterIndex?: number) => {
      setItems((prev) => {
        const newItem = emptyItem(customColumns);
        if (afterIndex !== undefined) {
          const next = [...prev];
          next.splice(afterIndex + 1, 0, newItem);
          return next;
        }
        return [...prev, newItem];
      });
    },
    [customColumns]
  );

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }, []);

  const duplicateItem = useCallback((id: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx === -1) return prev;
      const src = prev[idx];
      const copy: LineItem = {
        ...src,
        id: nanoid(),
        attrs: { ...src.attrs },
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const moveItem = useCallback((fromId: string, toId: string) => {
    setItems((prev) => {
      const fromIdx = prev.findIndex((i) => i.id === fromId);
      const toIdx = prev.findIndex((i) => i.id === toId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const updateField = useCallback(
    (id: string, field: FixedColKey, value: string | number) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  const updateAttr = useCallback((id: string, colId: string, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, attrs: { ...item.attrs, [colId]: value } }
          : item
      )
    );
  }, []);

  const updateImage = useCallback((id: string, dataUrl: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, imageUrl: dataUrl } : item))
    );
  }, []);

  // ─── Custom column CRUD — kept in sync with columnConfigs ─────────────────

  const addColumn = useCallback((label: string) => {
    const id = `cc-${nanoid(6)}`;
    setCustomColumns((prev) => [...prev, { id, label }]);
    setItems((prev) =>
      prev.map((item) => ({ ...item, attrs: { ...item.attrs, [id]: "" } }))
    );
    // Append to column configs at the end of current order
    setColumnConfigs((prev) => {
      const maxOrder = prev.length > 0 ? Math.max(...prev.map((c) => c.order)) : -1;
      return [...prev, { id, label, visible: true, order: maxOrder + 1 }];
    });
  }, []);

  const renameColumn = useCallback((id: string, label: string) => {
    setCustomColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, label } : c))
    );
    // Keep the label in sync so the dropdown shows the updated name
    setColumnConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, label } : c))
    );
  }, []);

  const deleteColumn = useCallback((id: string) => {
    setCustomColumns((prev) => prev.filter((c) => c.id !== id));
    setItems((prev) =>
      prev.map((item) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: _removed, ...rest } = item.attrs;
        return { ...item, attrs: rest };
      })
    );
    setColumnConfigs((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ─── Catalog quick-add ────────────────────────────────────────────────────

  const addFromCatalog = useCallback(
    (name: string, unit: string, unitPrice: number) => {
      const attrs: Record<string, string> = {};
      customColumns.forEach((c) => (attrs[c.id] = ""));
      const newId = nanoid();
      setItems((prev) => [
        ...prev,
        { id: newId, name, description: "", qty: 1, unit, unitPrice, imageUrl: "", deliveryTime: "", attrs },
      ]);
      // QW-5: track new ID for row-in animation; clear after 600ms
      setNewItemIds((prev) => new Set([...prev, newId]));
      setTimeout(() => {
        setNewItemIds((prev) => {
          const next = new Set(prev);
          next.delete(newId);
          return next;
        });
      }, 600);
    },
    [customColumns]
  );

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!canSave) {
      setShowSaveHints(true);
      return;
    }
    if (!hasNamedLineItem) {
      toast(t("no_line_items_warning"), { variant: "default" });
    }
    setSaving(true);
    setShowSaveHints(false);
    const now = new Date().toISOString().split("T")[0];

    try {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }

      if (isEdit && initialId) {
        updateProposal(initialId, {
          title,
          company,
          companyEmail,
          companyPhone,
          client,
          clientEmail,
          clientCompany,
          clientPhone,
          notes,
          status,
          items,
          customColumns,
          displaySettings,
        });
        lastSavedRef.current = buildSnapshot();
        // MO-3: show "Saved ✓" for 1.5s then navigate
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          router.push(`/proposal/${initialId}`);
        }, 1200);
      } else {
        const id = `prop-${nanoid()}`;
        addProposal({
          id,
          title,
          company,
          companyEmail,
          companyPhone,
          client,
          clientEmail,
          clientCompany,
          clientPhone,
          notes,
          status,
          items,
          customColumns,
          displaySettings,
          createdAt: now,
          updatedAt: now,
        });
        lastSavedRef.current = buildSnapshot();
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          router.push(`/proposal/${id}`);
        }, 1200);
      }
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="-mx-4 sm:-mx-6 -mt-8">
      {/* ── Top bar (MO-1: left=nav, center=identity, right=ranked actions) ── */}
      <div className="sticky top-[52px] z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-2 sm:px-6">

          {/* LEFT: navigation only */}
          <Button variant="ghost" size="icon" asChild className="shrink-0 h-9 w-9">
            <Link href="/dashboard" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          {/* CENTER: identity — title + status */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {/* QW-4: sr-only label so screen readers announce the field (WCAG SC 4.1.2) */}
            <label htmlFor="proposal-title" className="sr-only">
              {t("proposal_title")}
            </label>
            <input
              id="proposal-title"
              placeholder={t("untitled_proposal")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-100
                         placeholder:text-zinc-600 outline-none
                         border-b border-transparent hover:border-zinc-700 focus:border-zinc-500
                         transition-colors"
            />

            {/* QW-10: colored left border on status select (Von Restorff) */}
            <Select value={status} onValueChange={(v) => setStatus(v as ProposalStatus)}>
              <SelectTrigger
                className="w-28 shrink-0 border-l-4 pl-2 h-8 text-xs"
                style={{ borderLeftColor: STATUS_HEX[status] }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("draft")}</SelectItem>
                <SelectItem value="sent">{t("sent")}</SelectItem>
                <SelectItem value="accepted">{t("accepted")}</SelectItem>
                <SelectItem value="declined">{t("declined")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* RIGHT: ranked by Fitts's Law — primary first, then secondary icon-only */}
          <div className="flex items-center gap-1 shrink-0">
            {/* MO-7: autosave timestamp (Zeigarnik: completed autosave = peace of mind) */}
            {autosaveLabel && !isDirty && (
              <span className="hidden sm:inline text-[10px] text-zinc-600 whitespace-nowrap mr-1">
                {autosaveLabel}
              </span>
            )}
            {isDirty && (
              <span className="hidden sm:inline text-xs text-amber-400/90 whitespace-nowrap mr-1">
                {t("unsaved_changes")}
              </span>
            )}

            {/* MO-3: Save button with "Saved ✓" confirmation state */}
            <Button
              onClick={handleSave}
              disabled={saving || saveSuccess}
              size="default"
              className="shrink-0 min-w-[80px] h-9 text-sm font-semibold transition-all"
              style={
                saveSuccess
                  ? { backgroundColor: "#059669", borderColor: "#059669" }
                  : { backgroundColor: displaySettings.accentColor, borderColor: displaySettings.accentColor }
              }
            >
              {saveSuccess ? (
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  Saved
                </span>
              ) : saving ? (
                t("saving")
              ) : isEdit ? (
                t("save")
              ) : (
                t("create")
              )}
            </Button>

            {/* Settings dropdown (icon-only, secondary) */}
            <FinalSettingsDropdown
              settings={displaySettings}
              onChange={setDisplaySettings}
              syncThemeAccent={syncThemeAccent}
              onSyncThemeAccentChange={persistSyncThemeAccent}
            />

            {/* Column manager (icon-only, tertiary) */}
            <ColumnManagerDropdown
              configs={columnConfigs}
              onChange={(newConfigs) => setColumnConfigs(newConfigs)}
              onAddColumn={addColumn}
            />

            {/* Preview toggle — desktop (icon-only) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPreviewOpen((v) => !v)}
              className="hidden lg:flex h-9 w-9"
              title={previewOpen ? t("hide_preview") : t("show_preview")}
            >
              {previewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>

            {/* Preview — mobile / tablet */}
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden h-8 gap-1.5"
              onClick={() => setMobilePreviewOpen(true)}
            >
              <Eye className="h-3.5 w-3.5" />
              {t("open_preview")}
            </Button>
          </div>
        </div>

        {/* MO-4: Completeness progress bar (Goal-Gradient Effect — Zeigarnik) */}
        <div className="h-[3px] w-full bg-zinc-800">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${completeness}%`,
              backgroundColor: completeness === 100 ? "#059669" : displaySettings.accentColor,
            }}
          />
        </div>
        {completeness === 100 && (
          <div className="flex items-center justify-end px-4 sm:px-6 py-1 bg-emerald-950/30">
            <span className="text-[10px] text-emerald-400 font-medium">✓ Ready to send</span>
          </div>
        )}
      </div>

      {showSaveHints && !canSave && (
        <div className="px-4 sm:px-6 py-2.5 border-b border-amber-900/40 bg-amber-950/25 text-xs text-amber-200/95">
          {!title.trim() && !client.trim()
            ? t("save_requires_both")
            : !title.trim()
              ? t("save_requires_title")
              : t("save_requires_client")}
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex items-start">
        {/* Editor — always full width */}
        <div className="min-w-0 flex-1 flex flex-col w-full">
          {/* Meta fields */}
          <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-zinc-800 space-y-3">
            {/* Row 1: Company name | Client name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="company" className="text-xs">
                  {t("your_company")}
                </Label>
                <Input
                  id="company"
                  placeholder={t("company_placeholder")}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="client" className="text-xs">
                  {t("client_required")}
                </Label>
                <Input
                  id="client"
                  placeholder={t("client_placeholder")}
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                />
              </div>
            </div>
            {/* Row 2: Company email + phone | Client email + company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="companyEmail" className="text-xs">{t("company_email")}</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    placeholder={t("email_placeholder")}
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="companyPhone" className="text-xs">{t("company_phone")}</Label>
                  <Input
                    id="companyPhone"
                    type="tel"
                    placeholder={t("phone_placeholder")}
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="clientEmail" className="text-xs">
                    {t("client_email_label")}
                  </Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    placeholder={t("client_email_placeholder")}
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clientPhone" className="text-xs">
                    {t("client_phone")}
                  </Label>
                  <Input
                    id="clientPhone"
                    type="tel"
                    placeholder={t("phone_placeholder")}
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>
            {/* Row 3: Client company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div />
              <div className="space-y-1">
                <Label htmlFor="clientCompany" className="text-xs">{t("client_company_label")} <span className="text-zinc-600">{t("optional_paren")}</span></Label>
                <Input
                  id="clientCompany"
                  placeholder={t("client_company_placeholder")}
                  value={clientCompany}
                  onChange={(e) => setClientCompany(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Items grid */}
          <ItemsGrid
            items={items}
            customColumns={customColumns}
            columnConfigs={columnConfigs}
            total={total}
            currency={displaySettings.currency}
            onAddItem={addItem}
            onDeleteItem={deleteItem}
            onDuplicateItem={duplicateItem}
            onMoveItem={moveItem}
            onUpdateField={updateField}
            onUpdateAttr={updateAttr}
            onUpdateImage={updateImage}
            onAddColumn={addColumn}
            onRenameColumn={renameColumn}
            onDeleteColumn={deleteColumn}
            userCatalog={userCatalog}
            onSaveToCatalog={saveToCatalog}
            newItemIds={newItemIds}
          />

          {/* Catalog quick-add */}
          <div className="border-t border-zinc-800">
            {/* Catalog header with toggle */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {t("quick_add_catalog")}
              </p>
              <button
                type="button"
                onClick={toggleCatalog}
                className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-300 transition-colors rounded px-1.5 py-0.5 hover:bg-zinc-800"
                title={catalogOpen ? "Collapse catalog" : "Expand catalog"}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-250",
                    !catalogOpen && "-rotate-90"
                  )}
                />
              </button>
            </div>
            {/* Collapsible content — MO-6: user-saved catalog */}
            <div
              style={{
                maxHeight: catalogOpen ? "800px" : "0px",
                overflow: "hidden",
                transition: "max-height 280ms ease",
              }}
            >
              <div className="px-4 sm:px-6 pb-5">
                {userCatalog.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic py-1">
                    Your saved products will appear here. Click{" "}
                    <Bookmark className="inline h-3 w-3 mx-0.5" />
                    on any row to save it.
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {userCatalog.map((p) => (
                      <div key={p.id} className="flex w-full items-center group/cat rounded hover:bg-zinc-800 transition-colors">
                        <button
                          onClick={() => addFromCatalog(p.name, p.unit, p.unitPrice)}
                          className="flex flex-1 items-center justify-between px-2 py-1 text-left text-xs"
                        >
                          <span className="text-zinc-300">{p.name}</span>
                          <span className="text-zinc-600">
                            {formatWithCurrency(p.unitPrice, displaySettings.currency)}/{p.unit}
                          </span>
                        </button>
                        <button
                          onClick={() => removeFromUserCatalog(p.id)}
                          className="mr-1.5 rounded p-1 text-zinc-700 hover:text-red-400 opacity-0 group-hover/cat:opacity-100 transition-all"
                          title="Remove from catalog"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Notes — optional, bottom of form */}
          <div className="px-4 sm:px-6 py-4 border-b border-zinc-800">
            {showNotes ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notes" className="text-xs">
                    {t("proposal_notes")}
                  </Label>
                  <button
                    type="button"
                    onClick={() => { setShowNotes(false); setNotes(""); }}
                    className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    {t("hide_notes")}
                  </button>
                </div>
                <Textarea
                  id="notes"
                  placeholder={t("notes_placeholder")}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNotes(true)}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("show_notes")}
              </button>
            )}
          </div>

          {/* Footer actions — Save is in top bar; only Cancel remains here */}
          <div className="flex justify-end gap-2 px-4 sm:px-6 py-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard">{t("cancel")}</Link>
            </Button>
          </div>
        </div>

      </div>

      {/* Floating preview — bottom-right (draggable, resizable; prefs in localStorage) */}
      {previewOpen && (
        <div
          ref={previewPanelRef}
          className={cn(
            "hidden lg:flex flex-col fixed z-50 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl",
            previewLayout == null && "bottom-5 right-5 w-[360px] max-h-[calc(100vh-90px)]"
          )}
          style={
            previewLayout
              ? {
                  left: previewLayout.left,
                  top: previewLayout.top,
                  width: previewLayout.width,
                  height: previewLayout.height,
                }
              : undefined
          }
        >
          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={onPreviewResizePointerDown}
            className="absolute left-0 top-0 bottom-2.5 z-20 w-2.5 cursor-ew-resize select-none hover:bg-gray-200/50 active:bg-gray-200/80"
            title={t("preview_resize_handle")}
            style={{ touchAction: "none" }}
          />
          <div
            role="separator"
            aria-orientation="horizontal"
            onPointerDown={onPreviewHeightResizePointerDown}
            className="absolute bottom-0 left-0 right-0 z-20 h-2.5 cursor-ns-resize select-none hover:bg-gray-200/50 active:bg-gray-200/80"
            title={t("preview_resize_height_handle")}
            style={{ touchAction: "none" }}
          />
          {/* Preview label bar — drag handle */}
          <div
            onPointerDown={onPreviewHeaderPointerDown}
            className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200 shrink-0 cursor-grab active:cursor-grabbing select-none"
            style={{ touchAction: "none" }}
            title={t("preview_drag_to_move")}
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              {t("live_preview")}
            </span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setPreviewOpen(false)}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              title={t("hide_preview")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-auto min-h-0 flex-1 bg-zinc-100/30">
            <ProposalDocument
              proposal={previewAsProposal}
              proposalImage={proposalImagePreview}
              formattedDate={formattedPreviewDate}
            />
          </div>
        </div>
      )}

      <Dialog open={mobilePreviewOpen} onOpenChange={setMobilePreviewOpen}>
        <DialogContent className="fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-zinc-800 p-0 sm:rounded-none">
          <DialogHeader className="border-b border-zinc-800 px-4 py-3 text-left shrink-0">
            <DialogTitle className="text-base">{t("preview_sheet_title")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto bg-zinc-900 p-4">
            <ProposalDocument
              proposal={previewAsProposal}
              proposalImage={proposalImagePreview}
              formattedDate={formattedPreviewDate}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Items grid ───────────────────────────────────────────────────────────────

interface ItemsGridProps {
  items: LineItem[];
  customColumns: CustomColumn[];
  columnConfigs: ColumnConfig[];
  total: number;
  currency: Currency;
  onAddItem: (afterIndex?: number) => void;
  onDeleteItem: (id: string) => void;
  onDuplicateItem: (id: string) => void;
  onMoveItem: (fromId: string, toId: string) => void;
  onUpdateField: (id: string, field: FixedColKey, value: string | number) => void;
  onUpdateAttr: (id: string, colId: string, value: string) => void;
  onUpdateImage: (id: string, dataUrl: string) => void;
  onAddColumn: (label: string) => void;
  onRenameColumn: (id: string, label: string) => void;
  onDeleteColumn: (id: string) => void;
  userCatalog: UserCatalogItem[];
  onSaveToCatalog: (item: LineItem) => void;
  newItemIds: Set<string>;
}

function ItemsGrid({
  items,
  customColumns,
  columnConfigs,
  total,
  currency,
  onAddItem,
  onDeleteItem,
  onDuplicateItem,
  onMoveItem,
  onUpdateField,
  onUpdateAttr,
  onUpdateImage,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
  userCatalog,
  onSaveToCatalog,
  newItemIds,
}: ItemsGridProps) {
  const t = useT();
  const [keyboardTipsOpen, setKeyboardTipsOpen] = useState(false);
  const [showAddCol, setShowAddCol] = useState(false);
  const [addColLabel, setAddColLabel] = useState("");
  const [editColId, setEditColId] = useState<string | null>(null);
  const [editColLabel, setEditColLabel] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Keyed refs: `${rowIndex}-${colKey}` → input element
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Derive the ordered, visible column list from configs
  const orderedVisibleCols = [...columnConfigs]
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order);

  function refCallback(rowIndex: number, colKey: string) {
    return (el: HTMLInputElement | null) => {
      const k = `${rowIndex}-${colKey}`;
      if (el) cellRefs.current.set(k, el);
      else cellRefs.current.delete(k);
    };
  }

  function focusCell(rowIndex: number, colKey: string) {
    const el = cellRefs.current.get(`${rowIndex}-${colKey}`);
    if (el) {
      el.focus();
      el.select();
    }
  }

  // Navigate only through visible columns in their current order
  const allColKeys = orderedVisibleCols.map((c) => c.id);

  // MO-9: focus management after row delete
  function handleDeleteItem(id: string, rowIndex: number) {
    const nextFocusRow = rowIndex > 0 ? rowIndex - 1 : 0;
    onDeleteItem(id);
    requestAnimationFrame(() => {
      focusCell(nextFocusRow, allColKeys[0] ?? "name");
    });
  }

  function handleCellKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colKey: string
  ) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < items.length - 1) focusCell(rowIndex + 1, colKey);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) focusCell(rowIndex - 1, colKey);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      onAddItem(rowIndex);
      setTimeout(() => focusCell(rowIndex + 1, allColKeys[0] ?? "name"), 0);
      return;
    }
    if (e.key === "Tab" && !e.shiftKey) {
      const idx = allColKeys.indexOf(colKey);
      if (idx === allColKeys.length - 1) {
        e.preventDefault();
        if (rowIndex === items.length - 1) {
          onAddItem();
          setTimeout(() => focusCell(rowIndex + 1, allColKeys[0] ?? "name"), 0);
        } else {
          focusCell(rowIndex + 1, allColKeys[0] ?? "name");
        }
      }
    }
    if (e.key === "Tab" && e.shiftKey) {
      const idx = allColKeys.indexOf(colKey);
      if (idx === 0 && rowIndex > 0) {
        e.preventDefault();
        focusCell(rowIndex - 1, allColKeys[allColKeys.length - 1]);
      }
    }
  }

  function commitAddCol() {
    if (addColLabel.trim()) {
      onAddColumn(addColLabel.trim());
      setAddColLabel("");
      setShowAddCol(false);
    } else {
      setShowAddCol(false);
    }
  }

  function startEditCol(col: CustomColumn) {
    setEditColId(col.id);
    setEditColLabel(col.label);
  }

  function commitEditCol() {
    if (editColId && editColLabel.trim()) {
      onRenameColumn(editColId, editColLabel.trim());
    }
    setEditColId(null);
  }

  return (
    <div className="border-b border-zinc-800">
      <div className="px-4 sm:px-6 pt-3 pb-2">
        <button
          type="button"
          onClick={() => setKeyboardTipsOpen((o) => !o)}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Keyboard className="h-3.5 w-3.5 shrink-0" />
          {t("keyboard_tips_title")}
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              keyboardTipsOpen && "rotate-90"
            )}
          />
        </button>
        {keyboardTipsOpen && (
          <p className="mt-2 text-xs text-zinc-600 leading-relaxed max-w-xl">
            {t("keyboard_tips_body")}
          </p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/60">
            {/* Row # */}
            <th className="w-8 px-2 py-2 text-right text-[10px] font-medium text-zinc-600 sticky left-0 z-20 bg-zinc-900/95 backdrop-blur-sm border-r border-zinc-800/80" />

            {/* Ordered visible columns (fixed and custom interleaved) */}
            {orderedVisibleCols.map((colConfig) => {
              const fixedCol = FIXED_COL_MAP.get(colConfig.id);

              if (fixedCol) {
                return (
                  <th
                    key={fixedCol.key}
                    className={cn(
                      "px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500",
                      fixedCol.thClass,
                      fixedCol.align === "right" ? "text-right" : "text-left",
                      fixedCol.key === "name" &&
                        "sticky left-8 z-[19] bg-zinc-900/95 backdrop-blur-sm border-r border-zinc-800/80"
                    )}
                  >
                    {t(FIXED_COL_LABEL_KEYS[fixedCol.key])}
                  </th>
                );
              }

              // Custom column header
              const customCol = customColumns.find((c) => c.id === colConfig.id);
              if (!customCol) return null;
              return (
                <th
                  key={customCol.id}
                  className="min-w-[110px] px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 text-left"
                >
                  {editColId === customCol.id ? (
                    <input
                      autoFocus
                      value={editColLabel}
                      onChange={(e) => setEditColLabel(e.target.value)}
                      onBlur={commitEditCol}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEditCol();
                        if (e.key === "Escape") setEditColId(null);
                      }}
                      className="w-full rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-100 outline-none"
                    />
                  ) : (
                    <span className="group/col flex items-center gap-1">
                      <button
                        onClick={() => startEditCol(customCol)}
                        title={t("click_to_rename")}
                        className="hover:text-zinc-200 transition-colors"
                      >
                        {customCol.label}
                      </button>
                      <button
                        onClick={() => onDeleteColumn(customCol.id)}
                        className="opacity-0 group-hover/col:opacity-100 rounded p-0.5 text-zinc-600 hover:text-red-400 transition-all"
                        title={t("remove_column")}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  )}
                </th>
              );
            })}

            {/* Add column */}
            <th className="w-8 px-1 py-2">
              {showAddCol ? (
                <span className="flex items-center gap-1 min-w-[130px]">
                  <input
                    autoFocus
                    value={addColLabel}
                    onChange={(e) => setAddColLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitAddCol();
                      if (e.key === "Escape") {
                        setShowAddCol(false);
                        setAddColLabel("");
                      }
                    }}
                    onBlur={commitAddCol}
                    placeholder={t("column_name_placeholder")}
                    className="w-full min-w-[100px] rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-100 outline-none placeholder:text-zinc-600"
                  />
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitAddCol();
                    }}
                    className="rounded p-0.5 bg-zinc-700 hover:bg-zinc-600"
                  >
                    <Check className="h-3 w-3 text-zinc-300" />
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setShowAddCol(true)}
                  className="rounded p-1 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                  title={t("add_custom_column")}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </th>

            {/* Total + delete */}
            <th className="w-[88px] px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("col_total")}
            </th>
            <th className="w-[52px]" />
          </tr>
        </thead>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <tbody className="divide-y divide-zinc-800/60">
          {items.map((item, rowIndex) => (
            <ItemRow
              key={item.id}
              item={item}
              rowIndex={rowIndex}
              customColumns={customColumns}
              orderedVisibleCols={orderedVisibleCols}
              currency={currency}
              refCallback={refCallback}
              onUpdateField={onUpdateField}
              onUpdateAttr={onUpdateAttr}
              onUpdateImage={onUpdateImage}
              onDelete={() => handleDeleteItem(item.id, rowIndex)}
              onDuplicate={() => onDuplicateItem(item.id)}
              onKeyDown={handleCellKeyDown}
              canDelete={items.length > 1}
              isDragOver={dragOverId === item.id}
              isNew={newItemIds.has(item.id)}
              onDragStart={() => { /* stored in dataTransfer below */ }}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(item.id); }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(draggedId) => { setDragOverId(null); onMoveItem(draggedId, item.id); }}
              isSavedInCatalog={userCatalog.some(
                (c) => c.name === item.name && c.unit === item.unit && c.unitPrice === item.unitPrice
              )}
              onSaveToCatalog={() => onSaveToCatalog(item)}
              onMoveUp={rowIndex > 0 ? () => onMoveItem(item.id, items[rowIndex - 1].id) : null}
              onMoveDown={rowIndex < items.length - 1 ? () => onMoveItem(item.id, items[rowIndex + 1].id) : null}
            />
          ))}
        </tbody>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <tfoot>
          <tr className="border-t border-zinc-800">
            {/* colSpan = 1 (row#) + visible cols + 1 (add-col header) */}
            <td
              colSpan={orderedVisibleCols.length + 2}
              className="px-4 py-2.5"
            >
              <button
                onClick={() => onAddItem()}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("add_row")}
              </button>
            </td>
            <td className="py-2.5 px-2 text-right text-sm font-bold font-mono text-zinc-100 whitespace-nowrap">
              {formatWithCurrency(total, currency)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
}

// ─── Item row ─────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: LineItem;
  rowIndex: number;
  customColumns: CustomColumn[];
  orderedVisibleCols: ColumnConfig[];
  currency: Currency;
  canDelete: boolean;
  isDragOver: boolean;
  isNew: boolean;
  isSavedInCatalog: boolean;
  refCallback: (
    rowIndex: number,
    colKey: string
  ) => (el: HTMLInputElement | null) => void;
  onUpdateField: (id: string, field: FixedColKey, value: string | number) => void;
  onUpdateAttr: (id: string, colId: string, value: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSaveToCatalog: () => void;
  onKeyDown: (
    e: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colKey: string
  ) => void;
  onUpdateImage: (id: string, dataUrl: string) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (draggedId: string) => void;
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
}

function ItemRow({
  item,
  rowIndex,
  customColumns,
  orderedVisibleCols,
  currency,
  canDelete,
  isDragOver,
  isNew,
  isSavedInCatalog,
  refCallback,
  onUpdateField,
  onUpdateAttr,
  onUpdateImage,
  onDelete,
  onDuplicate,
  onSaveToCatalog,
  onKeyDown,
  onDragOver,
  onDragLeave,
  onDrop,
  onMoveUp,
  onMoveDown,
}: ItemRowProps) {
  const t = useT();
  const lineTotal = item.qty * item.unitPrice;

  const cellBase =
    "w-full bg-transparent rounded px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none border border-transparent hover:border-zinc-700 focus:border-zinc-500 focus:bg-zinc-800/60 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <tr
      className={cn(
        "group/row hover:bg-zinc-800/20 transition-colors",
        isDragOver && "border-t-2 border-t-blue-500 bg-zinc-800/30",
        isNew && "animate-row-in"
      )}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.getData("text/plain")); }}
    >
      {/* Drag handle + row number */}
      <td className="w-8 px-1 select-none sticky left-0 z-20 bg-zinc-950/95 backdrop-blur-sm border-r border-zinc-800/80">
        <div className="flex items-center justify-end gap-0.5">
          {/* MO-5: keyboard-accessible row reorder — Space enters move mode, ↑/↓ moves, Escape cancels */}
          <span
            tabIndex={0}
            role="button"
            aria-label={`Move row ${rowIndex + 1}`}
            className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300 opacity-0 group-hover/row:opacity-100 focus:opacity-100 focus:text-zinc-300 transition-opacity focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") { e.preventDefault(); onMoveUp?.(); }
              if (e.key === "ArrowDown") { e.preventDefault(); onMoveDown?.(); }
            }}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] text-zinc-500 tabular-nums w-4 text-right">
            {rowIndex + 1}
          </span>
        </div>
      </td>

      {/* Ordered visible columns */}
      {orderedVisibleCols.map((colConfig) => {
        const fixedCol = FIXED_COL_MAP.get(colConfig.id);

        if (fixedCol) {
          // ── Image column: file picker + thumbnail ──────────────────────
          if (fixedCol.key === "imageUrl") {
            return (
              <td key="imageUrl" className="w-20 px-1 py-1">
                <label className="cursor-pointer flex items-center justify-center w-16 h-16 mx-auto">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-16 h-16 object-cover rounded-md border border-zinc-700"
                    />
                  ) : (
                    <span className="w-16 h-16 flex items-center justify-center rounded-md border border-dashed border-zinc-700 text-zinc-600 hover:border-zinc-500 hover:text-zinc-400 transition-colors">
                      <ImageIcon className="h-5 w-5" />
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        onUpdateImage(item.id, ev.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </td>
            );
          }

          const rawValue = item[fixedCol.key];
          const value = rawValue as string | number;

          // ── Unit column: render as dropdown ────────────────────────────
          if (fixedCol.key === "unit") {
            const unitVal = value as string;
            // If stored value is not in list, show it as a custom option
            const inList = UNIT_OPTIONS.includes(unitVal);
            return (
              <td key="unit" className={cn("px-1 py-0.5", fixedCol.thClass)}>
                <select
                  value={inList ? unitVal : ""}
                  onChange={(e) => onUpdateField(item.id, "unit", e.target.value)}
                  className="w-full bg-transparent rounded px-1.5 py-1.5 text-sm text-zinc-100 outline-none border border-transparent hover:border-zinc-700 focus:border-zinc-500 focus:bg-zinc-800/60 transition-colors cursor-pointer"
                  style={{ colorScheme: "dark" }}
                >
                  {!inList && unitVal && (
                    <option value="" disabled className="bg-zinc-900 text-zinc-400">
                      {unitVal}
                    </option>
                  )}
                  {UNIT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-zinc-900 text-zinc-100">
                      {opt}
                    </option>
                  ))}
                </select>
              </td>
            );
          }

          return (
            <td
              key={fixedCol.key}
              className={cn(
                "px-1 py-0.5",
                fixedCol.thClass,
                fixedCol.key === "name" &&
                  "sticky left-8 z-[19] bg-zinc-950/95 backdrop-blur-sm border-r border-zinc-800/80"
              )}
            >
              <input
                ref={refCallback(rowIndex, fixedCol.key)}
                type={fixedCol.inputType}
                value={value}
                placeholder={
                  FIXED_COL_PLACEHOLDER_KEYS[fixedCol.key]
                    ? t(FIXED_COL_PLACEHOLDER_KEYS[fixedCol.key]!)
                    : (fixedCol.placeholder ?? "")
                }
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const v =
                    fixedCol.inputType === "number"
                      ? parseFloat(e.target.value) || 0
                      : e.target.value;
                  onUpdateField(item.id, fixedCol.key, v);
                }}
                onKeyDown={(e) => onKeyDown(e, rowIndex, fixedCol.key)}
                className={`${cellBase} ${
                  fixedCol.align === "right" ? "text-right" : ""
                }`}
              />
            </td>
          );
        }

        // Custom column cell
        const customCol = customColumns.find((c) => c.id === colConfig.id);
        if (!customCol) return null;
        return (
          <td key={customCol.id} className="min-w-[110px] px-1 py-0.5">
            <input
              ref={refCallback(rowIndex, customCol.id)}
              type="text"
              value={item.attrs?.[customCol.id] ?? ""}
              onChange={(e) => onUpdateAttr(item.id, customCol.id, e.target.value)}
              onKeyDown={(e) => onKeyDown(e, rowIndex, customCol.id)}
              className={cellBase}
            />
          </td>
        );
      })}

      {/* Spacer under add-column header */}
      <td className="w-8" />

      {/* Line total */}
      <td className="w-[88px] px-2 text-right text-sm font-mono text-zinc-400 tabular-nums whitespace-nowrap">
        {formatWithCurrency(lineTotal, currency)}
      </td>

      {/* Save-to-catalog + duplicate + delete */}
      <td className="w-[52px] px-0.5">
        <div className="flex items-center justify-end gap-0">
          {/* MO-6: save row to user catalog (only shown when row has a name) */}
          {item.name.trim() && (
            <button
              type="button"
              onClick={onSaveToCatalog}
              className={cn(
                "rounded p-1 transition-all opacity-0 group-hover/row:opacity-100",
                isSavedInCatalog
                  ? "text-blue-400 cursor-default"
                  : "text-zinc-600 hover:text-blue-400 hover:bg-zinc-800"
              )}
              title={isSavedInCatalog ? "Already in catalog" : "Save to catalog"}
              disabled={isSavedInCatalog}
            >
              {isSavedInCatalog ? (
                <BookmarkCheck className="h-3.5 w-3.5" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded p-1 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all opacity-0 group-hover/row:opacity-100"
            title={t("duplicate")}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete}
            className="rounded p-1 text-zinc-600 hover:text-red-400 hover:bg-red-900/20 disabled:invisible transition-all opacity-0 group-hover/row:opacity-100"
            title={t("delete_row")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
