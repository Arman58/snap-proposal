"use client";

import {
  formatCurrency,
  proposalTotal,
  STATUS_CONFIG,
  type LineItem,
  type CustomColumn,
  type ProposalStatus,
} from "@/store/proposals";
import { cn } from "@/lib/utils";

interface ProposalPreviewProps {
  title: string;
  company: string;
  client: string;
  clientEmail: string;
  notes: string;
  items: LineItem[];
  customColumns: CustomColumn[];
  status: ProposalStatus;
}

export function ProposalPreview({
  title,
  company,
  client,
  clientEmail,
  notes,
  items,
  customColumns,
  status,
}: ProposalPreviewProps) {
  const total = proposalTotal(items);
  const visibleItems = items.filter((i) => i.name.trim() !== "");

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="p-4 lg:p-5 w-full">
      {/* Label */}
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
        Preview
      </p>

      {/* Document card */}
      <div className="overflow-hidden rounded-xl border border-zinc-700/70 bg-white text-gray-900 shadow-xl">
        {/* Dark header */}
        <div className="bg-zinc-950 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {company && (
                <p className="text-[10px] font-medium text-zinc-500 mb-0.5">{company}</p>
              )}
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
                Proposal
              </p>
              <h2 className="mt-1 text-sm font-semibold text-zinc-100 leading-snug tracking-tight">
                {title || (
                  <span className="text-zinc-700 font-normal italic text-xs">
                    Untitled Proposal
                  </span>
                )}
              </h2>
            </div>
            <span
              className={cn(
                "shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold",
                cfg.className
              )}
            >
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Client + date */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-3">
          <div className="min-w-0">
            <p className="text-[8px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
              Prepared for
            </p>
            <p className="text-xs font-medium text-gray-800 leading-snug">
              {client || (
                <span className="text-gray-400 italic font-normal">Client</span>
              )}
            </p>
            {clientEmail && (
              <p className="text-[10px] text-gray-500 mt-0.5">{clientEmail}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[8px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
              Date
            </p>
            <p className="text-[10px] text-gray-500">{today}</p>
          </div>
        </div>

        {/* Items table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="px-4 py-2 text-left text-[8px] font-semibold uppercase tracking-widest text-gray-400">
                  Item
                </th>
                {customColumns.map((col) => (
                  <th
                    key={col.id}
                    className="px-3 py-2 text-left text-[8px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-[8px] font-semibold uppercase tracking-widest text-gray-400">
                  Qty
                </th>
                <th className="px-3 py-2 text-right text-[8px] font-semibold uppercase tracking-widest text-gray-400">
                  Price
                </th>
                <th className="px-4 py-2 text-right text-[8px] font-semibold uppercase tracking-widest text-gray-400">
                  Total
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {visibleItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={4 + customColumns.length}
                    className="px-4 py-5 text-center text-[11px] text-gray-400 italic"
                  >
                    Products will appear here…
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800 leading-tight">
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </td>
                    {customColumns.map((col) => (
                      <td
                        key={col.id}
                        className="px-3 py-2.5 text-gray-500 whitespace-nowrap"
                      >
                        {item.attrs?.[col.id] ?? ""}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 whitespace-nowrap">
                      {item.qty} {item.unit}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 whitespace-nowrap">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-800 whitespace-nowrap">
                      {formatCurrency(item.qty * item.unitPrice)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Total row */}
            <tfoot>
              <tr className="border-t-2 border-gray-100">
                <td
                  colSpan={3 + customColumns.length}
                  className="px-4 py-3 text-right text-[10px] font-semibold text-gray-500"
                >
                  Total
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-gray-900">
                  {formatCurrency(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes */}
        {notes && (
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="text-[8px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Notes
            </p>
            <p className="text-[10px] text-gray-500 leading-relaxed whitespace-pre-wrap">
              {notes}
            </p>
          </div>
        )}

        {/* Signature hint */}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <div className="h-px w-20 border-t border-dashed border-gray-200" />
          <p className="text-[9px] text-gray-400">Client signature</p>
          <div className="h-px w-20 border-t border-dashed border-gray-200" />
        </div>
      </div>
    </div>
  );
}
