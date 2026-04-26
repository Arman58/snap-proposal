"use client";

import {
  formatWithCurrency,
  proposalTotal,
  STATUS_CONFIG,
  type LineItem,
  type CustomColumn,
  type ProposalStatus,
  type Currency,
} from "@/store/proposals";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface ProposalPreviewProps {
  title: string;
  company: string;
  companyEmail?: string;
  companyPhone?: string;
  client: string;
  clientEmail: string;
  clientCompany?: string;
  clientPhone?: string;
  notes: string;
  items: LineItem[];
  customColumns: CustomColumn[];
  status: ProposalStatus;
  showPrice?: boolean;
  showTotal?: boolean;
  showDescription?: boolean;
  showDeliveryTime?: boolean;
  currency?: Currency;
  spacing?: "compact" | "comfortable";
  accentColor?: string;
}

export function ProposalPreview({
  title,
  company,
  companyEmail,
  companyPhone,
  client,
  clientEmail,
  clientCompany,
  clientPhone,
  notes,
  items,
  customColumns,
  status,
  showPrice = true,
  showTotal = true,
  showDescription = true,
  showDeliveryTime = true,
  currency = "USD",
  spacing = "comfortable",
  accentColor = "#18181b",
}: ProposalPreviewProps) {
  const { locale, t } = useI18n();
  const total = proposalTotal(items);
  const visibleItems = items.filter((i) => i.name.trim() !== "");

  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const today = new Date().toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const cfg = STATUS_CONFIG[status];
  const fmt = (n: number) => formatWithCurrency(n, currency);
  const rowPy = spacing === "compact" ? "py-1.5" : "py-2.5";

  const hasImage = visibleItems.some((i) => i.imageUrl);
  let colSpan = 1;
  if (customColumns.length) colSpan += customColumns.length;
  colSpan += 1;
  if (showPrice) colSpan += 1;
  if (showDeliveryTime) colSpan += 1;
  if (hasImage) colSpan += 1;

  return (
    <div
      className="w-full bg-white text-gray-900 text-[11px] leading-snug"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
    >
      {/* ── Accent stripe ───────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: accentColor, height: "3px" }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3.5 pb-3 bg-white border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className="text-[8px] font-bold uppercase tracking-[0.18em] mb-1"
              style={{ color: accentColor }}
            >
              {t("commercial_proposal")}
            </p>
            <h2 className="text-sm font-semibold text-gray-900 leading-tight tracking-tight">
              {title || (
                <span className="text-gray-400 font-normal italic">{t("preview_untitled")}</span>
              )}
            </h2>
            {company && (
              <p className="mt-0.5 text-[10px] text-gray-600 font-medium">{company}</p>
            )}
            {(companyEmail || companyPhone) && (
              <p className="mt-0.5 text-[9px] text-gray-400">
                {[companyEmail, companyPhone].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <span
            className={cn(
              "shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-[8px] font-semibold whitespace-nowrap",
              cfg.className
            )}
          >
            {t(status)}
          </span>
        </div>
      </div>

      {/* ── Client + date ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-2.5 bg-gray-50/50">
        <div className="min-w-0">
          <p className="text-[7px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
            {t("prepared_for")}
          </p>
          <p className="text-xs font-semibold text-gray-800">
            {client || <span className="text-gray-400 font-normal italic">{t("preview_client_placeholder")}</span>}
          </p>
          {clientCompany && (
            <p className="text-[9px] text-gray-500">{clientCompany}</p>
          )}
          {(clientEmail || clientPhone) && (
            <p className="text-[9px] text-gray-400 mt-0.5">
              {[clientEmail, clientPhone].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[7px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{t("proposal_date")}</p>
          <p className="text-[9px] text-gray-500">{today}</p>
        </div>
      </div>

      {/* ── Items table ────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr
              className="bg-white border-b-2"
              style={{ borderBottomColor: accentColor }}
            >
              {hasImage && <th className="w-8 px-2 py-2" />}
              <th
                className="px-3 py-2 text-left text-[7px] font-bold uppercase tracking-widest"
                style={{ color: accentColor }}
              >
                {t("preview_table_item")}
              </th>
              {showDeliveryTime && (
                <th
                  className="px-2 py-2 text-left text-[7px] font-bold uppercase tracking-widest whitespace-nowrap"
                  style={{ color: accentColor }}
                >
                  {t("preview_table_delivery")}
                </th>
              )}
              {customColumns.map((col) => (
                <th
                  key={col.id}
                  className="px-2 py-2 text-left text-[7px] font-bold uppercase tracking-widest whitespace-nowrap"
                  style={{ color: accentColor }}
                >
                  {col.label}
                </th>
              ))}
              <th
                className="px-2 py-2 text-right text-[7px] font-bold uppercase tracking-widest"
                style={{ color: accentColor }}
              >
                {t("col_qty")}
              </th>
              {showPrice && (
                <th
                  className="px-2 py-2 text-right text-[7px] font-bold uppercase tracking-widest"
                  style={{ color: accentColor }}
                >
                  {t("col_unit_price")}
                </th>
              )}
              {showTotal && (
                <th
                  className="px-3 py-2 text-right text-[7px] font-bold uppercase tracking-widest"
                  style={{ color: accentColor }}
                >
                  {t("col_total")}
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {visibleItems.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan + (showTotal ? 1 : 0)}
                  className="px-3 py-4 text-center text-[10px] text-gray-400 italic"
                >
                  {t("preview_empty")}
                </td>
              </tr>
            ) : (
              visibleItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  {hasImage && (
                    <td className={cn("w-8 px-2", rowPy)}>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="w-7 h-7 object-cover rounded border border-gray-200"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded border border-dashed border-gray-200 bg-gray-50" />
                      )}
                    </td>
                  )}
                  <td className={cn("px-3", rowPy)}>
                    <p className="font-medium text-gray-800 text-[11px] leading-tight">
                      {item.name}
                    </p>
                    {showDescription && item.description && (
                      <p className="text-[8px] text-gray-400 mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </td>
                  {showDeliveryTime && (
                    <td className={cn("px-2 text-[9px] text-gray-500 whitespace-nowrap", rowPy)}>
                      {item.deliveryTime || t("placeholder_dash")}
                    </td>
                  )}
                  {customColumns.map((col) => (
                    <td key={col.id} className={cn("px-2 text-[9px] text-gray-500 whitespace-nowrap", rowPy)}>
                      {item.attrs?.[col.id] ?? t("placeholder_dash")}
                    </td>
                  ))}
                  <td className={cn("px-2 text-right tabular-nums text-[9px] text-gray-600 whitespace-nowrap", rowPy)}>
                    {item.qty} {item.unit}
                  </td>
                  {showPrice && (
                    <td className={cn("px-2 text-right tabular-nums text-[9px] text-gray-600 whitespace-nowrap", rowPy)}>
                      {fmt(item.unitPrice)}
                    </td>
                  )}
                  {showTotal && (
                    <td className={cn("px-3 text-right tabular-nums text-[10px] font-semibold text-gray-800 whitespace-nowrap", rowPy)}>
                      {fmt(item.qty * item.unitPrice)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>

          {/* Total footer */}
          {showTotal && (
            <tfoot>
              <tr className="border-t border-gray-100">
                <td
                  colSpan={colSpan}
                  className="px-3 py-2 text-right text-[9px] font-semibold text-gray-400"
                >
                  {t("col_total")}
                </td>
                <td
                  className="px-3 py-2 text-right text-xs font-bold tabular-nums"
                  style={{ color: accentColor }}
                >
                  {fmt(total)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Notes ──────────────────────────────────────────────────────────── */}
      {notes && (
        <div className="border-t border-gray-100 px-4 py-2.5">
          <p
            className="text-[7px] font-bold uppercase tracking-widest mb-1"
            style={{ color: accentColor }}
          >
            {t("proposal_notes")}
          </p>
          <p className="text-[9px] text-gray-500 leading-relaxed whitespace-pre-wrap">
            {notes}
          </p>
        </div>
      )}

      {/* ── Signature hint ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
        <div className="h-px w-16 border-t-2 border-dashed" style={{ borderColor: accentColor + "55" }} />
        <p className="text-[8px] text-gray-400">{t("preview_client_signature")}</p>
        <div className="h-px w-16 border-t-2 border-dashed" style={{ borderColor: accentColor + "55" }} />
      </div>
    </div>
  );
}
