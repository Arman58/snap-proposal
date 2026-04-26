"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
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
  Loader2,
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
  formatCurrency,
  formatWithCurrency,
  DEFAULT_DISPLAY_SETTINGS,
  type LineItem,
  type CustomColumn,
  type ProposalStatus,
  type Currency,
  type DisplaySettings,
} from "@/store/proposals";
import { ProposalPreview } from "./proposal-preview";
import { PRODUCT_CATALOG } from "@/lib/mock-data";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
    thClass: "w-16",
    inputType: "text",
    align: "left",
    placeholder: "pcs",
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

// ─── Column Manager: defaults + localStorage helpers ──────────────────────────

const COL_STORAGE_KEY = "snap-proposal-col-configs";

const DEFAULT_FIXED_COL_CONFIGS: ColumnConfig[] = [
  { id: "imageUrl",      label: "Image",             visible: true,  order: 0 },
  { id: "name",          label: "Product / Service", visible: true,  order: 1, alwaysVisible: true },
  { id: "description",   label: "Description",       visible: true,  order: 2 },
  { id: "qty",           label: "Qty",               visible: true,  order: 3 },
  { id: "unit",          label: "Unit",              visible: false, order: 4 },
  { id: "unitPrice",     label: "Price",             visible: true,  order: 5, alwaysVisible: true },
  { id: "deliveryTime",  label: "Delivery Time",     visible: true,  order: 6 },
];

/**
 * Build initial column configs by merging localStorage preferences (if any)
 * with the fixed defaults and the current custom columns.
 */
function buildInitialColumnConfigs(customColumns: CustomColumn[]): ColumnConfig[] {
  let stored: ColumnConfig[] = [];
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(COL_STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {
      // ignore corrupted storage
    }
  }

  // Merge stored user prefs onto fixed column defaults
  const fixedConfigs: ColumnConfig[] = DEFAULT_FIXED_COL_CONFIGS.map((def) => {
    const s = stored.find((c) => c.id === def.id);
    return s ? { ...def, visible: s.visible, order: s.order } : { ...def };
  });

  const maxFixedOrder = Math.max(...fixedConfigs.map((c) => c.order));

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
    unit: "pcs",
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

// ─── Final Settings Dropdown ──────────────────────────────────────────────────

interface FinalSettingsDropdownProps {
  settings: DisplaySettings;
  onChange: (s: DisplaySettings) => void;
}

function FinalSettingsDropdown({ settings, onChange }: FinalSettingsDropdownProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
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
        <Settings2 className="h-3.5 w-3.5 mr-1" />
        {t("settings")}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
          <div className="px-3 pt-2.5 pb-1.5 border-b border-zinc-800">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("document_settings")}
            </p>
          </div>

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
          <div className="px-3 py-2 border-b border-zinc-800">
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

          {/* Accent color */}
          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              {t("accent_color")}
            </p>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <span
                className="h-6 w-6 rounded-full border-2 border-white/20 group-hover:border-white/40 shrink-0 transition-colors"
                style={{ backgroundColor: settings.accentColor }}
              />
              <input
                type="color"
                value={settings.accentColor}
                onChange={(e) => onChange({ ...settings, accentColor: e.target.value })}
                onInput={(e) => onChange({ ...settings, accentColor: (e.target as HTMLInputElement).value })}
                className="sr-only"
              />
              <span className="text-xs text-zinc-400 font-mono">{settings.accentColor}</span>
            </label>
          </div>
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
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(
    existing?.displaySettings ?? { ...DEFAULT_DISPLAY_SETTINGS }
  );
  const [items, setItems] = useState<LineItem[]>(
    existing?.items.length ? existing.items : [emptyItem([])]
  );
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(
    existing?.customColumns ?? []
  );

  // Column Manager state — initialised from localStorage + existing custom cols
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(() =>
    buildInitialColumnConfigs(existing?.customColumns ?? [])
  );

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [previewOpen, setPreviewOpen] = useState(true);

  const t = useT();
  const isEdit = Boolean(initialId);
  const total = proposalTotal(items);
  const canSave = title.trim() !== "" && client.trim() !== "";

  // Persist column configs whenever they change
  useEffect(() => {
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
      setItems((prev) => [
        ...prev,
        { id: nanoid(), name, description: "", qty: 1, unit, unitPrice, imageUrl: "", deliveryTime: "", attrs },
      ]);
    },
    [customColumns]
  );

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveStatus("saving");
    const now = new Date().toISOString().split("T")[0];

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
      router.push(`/proposal/${initialId}`);
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
      router.push(`/proposal/${id}`);
    }
    setSaving(false);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2500);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="-mx-4 sm:-mx-6 -mt-8">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="sticky top-[52px] z-30 flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 py-2.5 sm:px-6">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <input
          placeholder={t("untitled_proposal")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-zinc-100 placeholder:text-zinc-600 outline-none focus:text-zinc-100"
        />

        {/* Preview toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPreviewOpen((v) => !v)}
          className="shrink-0 hidden lg:flex"
          title={previewOpen ? t("hide_preview") : t("show_preview")}
        >
          {previewOpen ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>

        {/* Column manager */}
        <ColumnManagerDropdown
          configs={columnConfigs}
          onChange={(newConfigs) => setColumnConfigs(newConfigs)}
          onAddColumn={addColumn}
        />

        {/* Final settings */}
        <FinalSettingsDropdown
          settings={displaySettings}
          onChange={setDisplaySettings}
        />

        <Select
          value={status}
          onValueChange={(v) => setStatus(v as ProposalStatus)}
        >
          <SelectTrigger className="w-28 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">{t("draft")}</SelectItem>
            <SelectItem value="sent">{t("sent")}</SelectItem>
            <SelectItem value="accepted">{t("accepted")}</SelectItem>
            <SelectItem value="declined">{t("declined")}</SelectItem>
          </SelectContent>
        </Select>

        {/* Auto-save status badge */}
        {saveStatus !== "idle" && (
          <span className={cn(
            "flex items-center gap-1.5 text-xs font-medium transition-all",
            saveStatus === "saving" ? "text-zinc-500" : "text-emerald-400"
          )}>
            {saveStatus === "saving" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {saveStatus === "saving" ? t("saving") : t("saved")}
          </span>
        )}

        <Button
          onClick={handleSave}
          disabled={saving || !canSave}
          size="sm"
          className="shrink-0"
        >
          {saving ? t("saving") : isEdit ? t("save") : t("create")}
        </Button>
      </div>

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
                  <Label htmlFor="clientPhone" className="text-xs">Client Phone</Label>
                  <Input
                    id="clientPhone"
                    type="tel"
                    placeholder="+1 555 000"
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
            onAddItem={addItem}
            onDeleteItem={deleteItem}
            onMoveItem={moveItem}
            onUpdateField={updateField}
            onUpdateAttr={updateAttr}
            onUpdateImage={updateImage}
            onAddColumn={addColumn}
            onRenameColumn={renameColumn}
            onDeleteColumn={deleteColumn}
          />

          {/* Catalog quick-add */}
          <div className="border-t border-zinc-800 px-4 sm:px-6 py-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t("quick_add_catalog")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
              {PRODUCT_CATALOG.map((cat) => (
                <div key={cat.category}>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                    {cat.category}
                  </p>
                  <div className="space-y-0.5">
                    {cat.items.map((p) => (
                      <button
                        key={p.name}
                        onClick={() =>
                          addFromCatalog(p.name, p.unit, p.unitPrice)
                        }
                        className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs transition-colors hover:bg-zinc-800"
                      >
                        <span className="text-zinc-300">{p.name}</span>
                        <span className="text-zinc-600">
                          {formatCurrency(p.unitPrice)}/{p.unit}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
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

          {/* ── Color & Theme ──────────────────────────────────────────────── */}
          <div className="px-4 sm:px-6 py-5 border-b border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
              {t("accent_color")}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Preset swatches */}
              {[
                "#18181b",
                "#1e40af",
                "#065f46",
                "#7c3aed",
                "#be123c",
                "#b45309",
                "#0e7490",
                "#374151",
              ].map((color) => (
                <button
                  key={color}
                  onClick={() => setDisplaySettings((s) => ({ ...s, accentColor: color }))}
                  title={color}
                  className="h-7 w-7 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900"
                  style={{
                    backgroundColor: color,
                    borderColor:
                      displaySettings.accentColor === color
                        ? "white"
                        : "transparent",
                    boxShadow:
                      displaySettings.accentColor === color
                        ? `0 0 0 2px ${color}`
                        : undefined,
                  }}
                />
              ))}

              {/* Custom color picker */}
              <label className="relative cursor-pointer group flex items-center gap-2">
                <span
                  className="h-7 w-7 rounded-full border-2 border-dashed border-zinc-600 group-hover:border-zinc-400 transition-colors flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: displaySettings.accentColor }}
                >
                  <span className="text-[9px] font-bold text-white/70 select-none">+</span>
                </span>
                <input
                  type="color"
                  value={displaySettings.accentColor}
                  onChange={(e) =>
                    setDisplaySettings((s) => ({ ...s, accentColor: e.target.value }))
                  }
                  onInput={(e) =>
                    setDisplaySettings((s) => ({
                      ...s,
                      accentColor: (e.target as HTMLInputElement).value,
                    }))
                  }
                  className="sr-only"
                />
                <span className="text-xs text-zinc-500 font-mono group-hover:text-zinc-300 transition-colors">
                  {displaySettings.accentColor}
                </span>
              </label>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex justify-end gap-2 px-4 sm:px-6 py-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard">{t("cancel")}</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving ? t("saving") : isEdit ? t("save_changes") : t("create_proposal")}
            </Button>
          </div>
        </div>

      </div>

      {/* Floating preview — bottom-right */}
      {previewOpen && (
        <div className="hidden lg:flex flex-col fixed bottom-5 right-5 z-50 w-[360px] max-h-[calc(100vh-90px)] rounded-xl shadow-2xl overflow-hidden border border-gray-200 bg-white">
          {/* Preview label bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              {t("live_preview")}
            </span>
            <button
              onClick={() => setPreviewOpen(false)}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title={t("hide_preview")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="overflow-auto flex-1">
            <ProposalPreview
              title={title}
              company={company}
              companyEmail={companyEmail}
              companyPhone={companyPhone}
              client={client}
              clientEmail={clientEmail}
              clientCompany={clientCompany}
              clientPhone={clientPhone}
              notes={notes}
              items={items}
              customColumns={customColumns}
              status={status}
              showPrice={displaySettings.showPrice}
              showTotal={displaySettings.showTotal}
              showDescription={displaySettings.showDescription}
              showDeliveryTime={displaySettings.showDeliveryTime}
              currency={displaySettings.currency}
              spacing={displaySettings.spacing}
              accentColor={displaySettings.accentColor}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Items grid ───────────────────────────────────────────────────────────────

interface ItemsGridProps {
  items: LineItem[];
  customColumns: CustomColumn[];
  columnConfigs: ColumnConfig[];
  total: number;
  onAddItem: (afterIndex?: number) => void;
  onDeleteItem: (id: string) => void;
  onMoveItem: (fromId: string, toId: string) => void;
  onUpdateField: (id: string, field: FixedColKey, value: string | number) => void;
  onUpdateAttr: (id: string, colId: string, value: string) => void;
  onUpdateImage: (id: string, dataUrl: string) => void;
  onAddColumn: (label: string) => void;
  onRenameColumn: (id: string, label: string) => void;
  onDeleteColumn: (id: string) => void;
}

function ItemsGrid({
  items,
  customColumns,
  columnConfigs,
  total,
  onAddItem,
  onDeleteItem,
  onMoveItem,
  onUpdateField,
  onUpdateAttr,
  onUpdateImage,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
}: ItemsGridProps) {
  const t = useT();
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
    <div className="overflow-x-auto border-b border-zinc-800">
      <table className="w-full text-sm border-collapse">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/60">
            {/* Row # */}
            <th className="w-8 px-2 py-2 text-right text-[10px] font-medium text-zinc-600" />

            {/* Ordered visible columns (fixed and custom interleaved) */}
            {orderedVisibleCols.map((colConfig) => {
              const fixedCol = FIXED_COL_MAP.get(colConfig.id);

              if (fixedCol) {
                return (
                  <th
                    key={fixedCol.key}
                    className={`px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 ${
                      fixedCol.thClass
                    } ${fixedCol.align === "right" ? "text-right" : "text-left"}`}
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
            <th className="w-8" />
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
              refCallback={refCallback}
              onUpdateField={onUpdateField}
              onUpdateAttr={onUpdateAttr}
              onUpdateImage={onUpdateImage}
              onDelete={() => onDeleteItem(item.id)}
              onKeyDown={handleCellKeyDown}
              canDelete={items.length > 1}
              isDragOver={dragOverId === item.id}
              onDragStart={() => { /* stored in dataTransfer below */ }}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(item.id); }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(draggedId) => { setDragOverId(null); onMoveItem(draggedId, item.id); }}
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
              {formatCurrency(total)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Item row ─────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: LineItem;
  rowIndex: number;
  customColumns: CustomColumn[];
  orderedVisibleCols: ColumnConfig[];
  canDelete: boolean;
  isDragOver: boolean;
  refCallback: (
    rowIndex: number,
    colKey: string
  ) => (el: HTMLInputElement | null) => void;
  onUpdateField: (id: string, field: FixedColKey, value: string | number) => void;
  onUpdateAttr: (id: string, colId: string, value: string) => void;
  onDelete: () => void;
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
}

function ItemRow({
  item,
  rowIndex,
  customColumns,
  orderedVisibleCols,
  canDelete,
  isDragOver,
  refCallback,
  onUpdateField,
  onUpdateAttr,
  onUpdateImage,
  onDelete,
  onKeyDown,
  onDragOver,
  onDragLeave,
  onDrop,
}: ItemRowProps) {
  const t = useT();
  const lineTotal = item.qty * item.unitPrice;

  const cellBase =
    "w-full bg-transparent rounded px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-700 outline-none border border-transparent hover:border-zinc-700 focus:border-zinc-500 focus:bg-zinc-800/60 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <tr
      className={cn(
        "group/row hover:bg-zinc-800/20 transition-colors",
        isDragOver && "border-t-2 border-t-blue-500 bg-zinc-800/30"
      )}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.getData("text/plain")); }}
    >
      {/* Drag handle + row number */}
      <td className="w-8 px-1 select-none">
        <div className="flex items-center justify-end gap-0.5">
          <span className="cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-400 opacity-0 group-hover/row:opacity-100 transition-opacity">
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] text-zinc-700 tabular-nums w-4 text-right">
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
          return (
            <td key={fixedCol.key} className={`px-1 py-0.5 ${fixedCol.thClass}`}>
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
        {formatCurrency(lineTotal)}
      </td>

      {/* Delete */}
      <td className="w-8 px-1">
        <button
          onClick={onDelete}
          disabled={!canDelete}
          className="rounded p-1 text-zinc-600 hover:text-red-400 hover:bg-red-900/20 disabled:invisible transition-all"
          title={t("delete_row")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
