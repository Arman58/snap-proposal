"use client";

import {
  useState,
  useRef,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, Check, X, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { nanoid } from "@/lib/nanoid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  type LineItem,
  type CustomColumn,
  type ProposalStatus,
} from "@/store/proposals";
import { ProposalPreview } from "./proposal-preview";
import { PRODUCT_CATALOG } from "@/lib/mock-data";
import { useT } from "@/lib/i18n";

// ─── i18n key maps for FIXED_COLS (keeps FIXED_COLS const unchanged) ──────────

const FIXED_COL_LABEL_KEYS: Record<FixedColKey, string> = {
  name: "col_product_service",
  description: "col_description",
  qty: "col_qty",
  unit: "col_unit",
  unitPrice: "col_unit_price",
};

const FIXED_COL_PLACEHOLDER_KEYS: Partial<Record<FixedColKey, string>> = {
  name: "col_name_placeholder",
  description: "col_description_placeholder",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type FixedColKey = "name" | "description" | "qty" | "unit" | "unitPrice";

interface FixedColConfig {
  key: FixedColKey;
  label: string;
  thClass: string;
  inputType: "text" | "number";
  align: "left" | "right";
  placeholder?: string;
}

// ─── Column config (fixed columns) ────────────────────────────────────────────

const FIXED_COLS: FixedColConfig[] = [
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
    label: "Unit Price",
    thClass: "w-24",
    inputType: "number",
    align: "right",
  },
];

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
    attrs,
  };
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
  const [client, setClient] = useState(existing?.client ?? "");
  const [clientEmail, setClientEmail] = useState(existing?.clientEmail ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [status, setStatus] = useState<ProposalStatus>(
    existing?.status ?? "draft"
  );
  const [items, setItems] = useState<LineItem[]>(
    existing?.items.length ? existing.items : [emptyItem([])]
  );
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(
    existing?.customColumns ?? []
  );

  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);

  const t = useT();
  const isEdit = Boolean(initialId);
  const total = proposalTotal(items);
  const canSave = title.trim() !== "" && client.trim() !== "";

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

  // ─── Custom column CRUD ────────────────────────────────────────────────────

  const addColumn = useCallback((label: string) => {
    const id = `cc-${nanoid(6)}`;
    setCustomColumns((prev) => [...prev, { id, label }]);
    setItems((prev) =>
      prev.map((item) => ({ ...item, attrs: { ...item.attrs, [id]: "" } }))
    );
  }, []);

  const renameColumn = useCallback((id: string, label: string) => {
    setCustomColumns((prev) =>
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
  }, []);

  // ─── Catalog quick-add ────────────────────────────────────────────────────

  const addFromCatalog = useCallback(
    (name: string, unit: string, unitPrice: number) => {
      const attrs: Record<string, string> = {};
      customColumns.forEach((c) => (attrs[c.id] = ""));
      setItems((prev) => [
        ...prev,
        { id: nanoid(), name, description: "", qty: 1, unit, unitPrice, attrs },
      ]);
    },
    [customColumns]
  );

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const now = new Date().toISOString().split("T")[0];

    if (isEdit && initialId) {
      updateProposal(initialId, {
        title,
        company,
        client,
        clientEmail,
        notes,
        status,
        items,
        customColumns,
      });
      router.push(`/proposal/${initialId}`);
    } else {
      const id = `prop-${nanoid()}`;
      addProposal({
        id,
        title,
        company,
        client,
        clientEmail,
        notes,
        status,
        items,
        customColumns,
        createdAt: now,
        updatedAt: now,
      });
      router.push(`/proposal/${id}`);
    }
    setSaving(false);
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
      <div
        className={`flex items-start ${
          previewOpen ? "lg:divide-x lg:divide-zinc-800" : ""
        }`}
      >
        {/* LEFT: editor */}
        <div
          className={`min-w-0 flex-1 flex flex-col ${
            previewOpen ? "lg:w-[58%]" : "w-full"
          }`}
        >
          {/* Meta fields */}
          <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-zinc-800 space-y-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">
                  {t("client_email_label")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="client@company.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes" className="text-xs">
                {t("proposal_notes")}
              </Label>
              <Textarea
                id="notes"
                placeholder={t("notes_placeholder")}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>

          {/* Excel grid */}
          <ItemsGrid
            items={items}
            customColumns={customColumns}
            total={total}
            onAddItem={addItem}
            onDeleteItem={deleteItem}
            onUpdateField={updateField}
            onUpdateAttr={updateAttr}
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

        {/* RIGHT: live preview */}
        {previewOpen && (
          <div className="hidden lg:block lg:w-[42%] shrink-0 sticky top-[calc(52px+45px)] max-h-[calc(100vh-52px-45px)] overflow-auto">
            <ProposalPreview
              title={title}
              company={company}
              client={client}
              clientEmail={clientEmail}
              notes={notes}
              items={items}
              customColumns={customColumns}
              status={status}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Items grid ───────────────────────────────────────────────────────────────

interface ItemsGridProps {
  items: LineItem[];
  customColumns: CustomColumn[];
  total: number;
  onAddItem: (afterIndex?: number) => void;
  onDeleteItem: (id: string) => void;
  onUpdateField: (id: string, field: FixedColKey, value: string | number) => void;
  onUpdateAttr: (id: string, colId: string, value: string) => void;
  onAddColumn: (label: string) => void;
  onRenameColumn: (id: string, label: string) => void;
  onDeleteColumn: (id: string) => void;
}

function ItemsGrid({
  items,
  customColumns,
  total,
  onAddItem,
  onDeleteItem,
  onUpdateField,
  onUpdateAttr,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
}: ItemsGridProps) {
  const t = useT();
  const [showAddCol, setShowAddCol] = useState(false);
  const [addColLabel, setAddColLabel] = useState("");
  const [editColId, setEditColId] = useState<string | null>(null);
  const [editColLabel, setEditColLabel] = useState("");

  // Keyed refs: `${rowIndex}-${colKey}` → input element
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

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

  // All navigable column keys in order
  const allColKeys: string[] = [
    ...FIXED_COLS.map((c) => c.key),
    ...customColumns.map((c) => c.id),
  ];

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
      // Wait for state update then focus the new row
      setTimeout(() => focusCell(rowIndex + 1, "name"), 0);
      return;
    }
    if (e.key === "Tab" && !e.shiftKey) {
      const idx = allColKeys.indexOf(colKey);
      if (idx === allColKeys.length - 1) {
        // Wrap: move to first cell of next row or new row
        e.preventDefault();
        if (rowIndex === items.length - 1) {
          onAddItem();
          setTimeout(() => focusCell(rowIndex + 1, "name"), 0);
        } else {
          focusCell(rowIndex + 1, "name");
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

            {/* Fixed columns */}
            {FIXED_COLS.map((col) => (
              <th
                key={col.key}
                className={`px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 ${col.thClass} ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {t(FIXED_COL_LABEL_KEYS[col.key])}
              </th>
            ))}

            {/* Dynamic columns */}
            {customColumns.map((col) => (
              <th
                key={col.id}
                className="min-w-[110px] px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 text-left"
              >
                {editColId === col.id ? (
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
                      onClick={() => startEditCol(col)}
                      title={t("click_to_rename")}
                      className="hover:text-zinc-200 transition-colors"
                    >
                      {col.label}
                    </button>
                    <button
                      onClick={() => onDeleteColumn(col.id)}
                      className="opacity-0 group-hover/col:opacity-100 rounded p-0.5 text-zinc-600 hover:text-red-400 transition-all"
                      title={t("remove_column")}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
              </th>
            ))}

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
                      e.preventDefault(); // prevent onBlur on input
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
              refCallback={refCallback}
              onUpdateField={onUpdateField}
              onUpdateAttr={onUpdateAttr}
              onDelete={() => onDeleteItem(item.id)}
              onKeyDown={handleCellKeyDown}
              canDelete={items.length > 1}
            />
          ))}
        </tbody>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <tfoot>
          <tr className="border-t border-zinc-800">
            <td
              colSpan={FIXED_COLS.length + customColumns.length + 2}
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
  canDelete: boolean;
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
}

function ItemRow({
  item,
  rowIndex,
  customColumns,
  canDelete,
  refCallback,
  onUpdateField,
  onUpdateAttr,
  onDelete,
  onKeyDown,
}: ItemRowProps) {
  const t = useT();
  const lineTotal = item.qty * item.unitPrice;

  const cellBase =
    "w-full bg-transparent rounded px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-700 outline-none border border-transparent hover:border-zinc-700 focus:border-zinc-500 focus:bg-zinc-800/60 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <tr className="group/row hover:bg-zinc-800/20">
      {/* Row number */}
      <td className="w-8 px-2 text-right text-[11px] text-zinc-700 tabular-nums select-none">
        {rowIndex + 1}
      </td>

      {/* Fixed columns */}
      {FIXED_COLS.map((col) => {
        const rawValue = item[col.key];
        const value = rawValue as string | number;
        return (
          <td key={col.key} className={`px-1 py-0.5 ${col.thClass}`}>
            <input
              ref={refCallback(rowIndex, col.key)}
              type={col.inputType}
              value={value}
              placeholder={FIXED_COL_PLACEHOLDER_KEYS[col.key] ? t(FIXED_COL_PLACEHOLDER_KEYS[col.key]!) : (col.placeholder ?? "")}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const v =
                  col.inputType === "number"
                    ? parseFloat(e.target.value) || 0
                    : e.target.value;
                onUpdateField(item.id, col.key, v);
              }}
              onKeyDown={(e) => onKeyDown(e, rowIndex, col.key)}
              className={`${cellBase} ${col.align === "right" ? "text-right" : ""}`}
            />
          </td>
        );
      })}

      {/* Custom column cells */}
      {customColumns.map((col) => (
        <td key={col.id} className="min-w-[110px] px-1 py-0.5">
          <input
            ref={refCallback(rowIndex, col.id)}
            type="text"
            value={item.attrs?.[col.id] ?? ""}
            onChange={(e) => onUpdateAttr(item.id, col.id, e.target.value)}
            onKeyDown={(e) => onKeyDown(e, rowIndex, col.id)}
            className={cellBase}
          />
        </td>
      ))}

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
          className="opacity-0 group-hover/row:opacity-100 rounded p-1 text-zinc-600 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-0 transition-all"
          title={t("delete_row")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
