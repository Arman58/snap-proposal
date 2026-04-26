"use client";

import { Separator } from "@/components/ui/separator";
import {
  proposalTotal,
  formatWithCurrency,
  DEFAULT_DISPLAY_SETTINGS,
  DOCUMENT_FONT_STACK,
  type DocumentFont,
  type Proposal,
} from "@/store/proposals";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export interface ProposalDocumentProps {
  proposal: Proposal;
  proposalImage: string;
  /** Pre-formatted proposal date (same rules as view page). */
  formattedDate: string;
  /** Client-facing link: hide internal reference number. */
  clientMode?: boolean;
}

export function ProposalDocument({
  proposal,
  proposalImage,
  formattedDate,
  clientMode = false,
}: ProposalDocumentProps) {
  const { t } = useI18n();
  const total = proposalTotal(proposal.items);
  const customColumns = proposal.customColumns ?? [];
  const ds = { ...DEFAULT_DISPLAY_SETTINGS, ...proposal.displaySettings };
  const fontKey = (["inter", "system", "serif"] as const).includes(
    ds.documentFont as DocumentFont
  )
    ? (ds.documentFont as DocumentFont)
    : "inter";
  const docFont = DOCUMENT_FONT_STACK[fontKey];
  const fmt = (n: number) => formatWithCurrency(n, ds.currency);
  const rowPy = ds.spacing === "compact" ? "py-2" : "py-4";
  const hasImage = proposal.items.some((i) => i.imageUrl);

  return (
    <div className="flex justify-center">
      <div
        id="proposal-document"
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900
                   print:max-w-none print:rounded-none print:border-0"
        style={
          {
            fontFamily: docFont,
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          } as React.CSSProperties
        }
      >
        <div
          style={
            {
              backgroundColor: ds.accentColor,
              height: "4px",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            } as React.CSSProperties
          }
        />

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
                <p className="mt-1 text-sm font-medium text-gray-600">{proposal.company}</p>
              )}
              {(proposal.companyEmail || proposal.companyPhone) && (
                <p className="mt-0.5 text-xs text-gray-400">
                  {[proposal.companyEmail, proposal.companyPhone].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>

            <div className="shrink-0 text-right space-y-3">
              {!clientMode && (
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
              )}
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.12em] mb-0.5"
                  style={{ color: ds.accentColor }}
                >
                  {t("proposal_date")}
                </p>
                <p className="text-sm text-gray-700">{formattedDate}</p>
              </div>
            </div>
          </div>
        </div>

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

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr
                className="bg-white border-b-2"
                style={{ borderBottomColor: ds.accentColor }}
              >
                {hasImage && <th className="w-14 px-4 py-3 print:px-0" />}
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
              {proposal.items
                .filter((i) => i.name.trim())
                .map((item) => (
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
                    <td
                      className={cn(
                        "px-4 text-right tabular-nums text-sm text-gray-600 whitespace-nowrap",
                        rowPy
                      )}
                    >
                      {item.qty} {item.unit}
                    </td>
                    {ds.showPrice && (
                      <td
                        className={cn(
                          "px-4 text-right tabular-nums text-sm text-gray-600 whitespace-nowrap",
                          rowPy
                        )}
                      >
                        {fmt(item.unitPrice)}
                      </td>
                    )}
                    {ds.showTotal && (
                      <td
                        className={cn(
                          "px-8 text-right tabular-nums text-sm font-semibold text-gray-900 whitespace-nowrap print:px-0",
                          rowPy
                        )}
                      >
                        {fmt(item.qty * item.unitPrice)}
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {ds.showTotal && (
          <div className="flex justify-end border-t border-gray-100 px-8 py-5 print:px-0">
            <dl className="w-56 space-y-2">
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">{t("subtotal")}</dt>
                <dd className="tabular-nums text-gray-700 font-mono">{fmt(total)}</dd>
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

        <div className="border-t border-gray-100 px-8 py-8 print:px-0">
          <div className="grid grid-cols-2 gap-16">
            <div>
              <div
                className="h-9 border-b-2 border-dashed"
                style={{ borderColor: ds.accentColor + "55" }}
              />
              <p className="mt-2 text-xs text-gray-400">{t("signature_date")}</p>
              {proposal.company && (
                <p className="mt-0.5 text-xs font-medium text-gray-600">{proposal.company}</p>
              )}
            </div>
            <div>
              <div
                className="h-9 border-b-2 border-dashed"
                style={{ borderColor: ds.accentColor + "55" }}
              />
              <p className="mt-2 text-xs text-gray-400">{t("client_signature_date")}</p>
              <p className="mt-0.5 text-xs font-medium text-gray-600">{proposal.client}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
