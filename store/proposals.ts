"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MOCK_PROPOSALS } from "@/lib/mock-data";

export type ProposalStatus = "draft" | "sent" | "accepted" | "declined";

/** A user-defined extra column that appears across all items. */
export interface CustomColumn {
  id: string;
  label: string;
}

export interface LineItem {
  id: string;
  name: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  /** Values for each custom column keyed by CustomColumn.id */
  attrs: Record<string, string>;
}

export interface Proposal {
  id: string;
  title: string;
  /** The business issuing this proposal */
  company: string;
  client: string;
  clientEmail: string;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
  notes: string;
  items: LineItem[];
  customColumns: CustomColumn[];
}

interface ProposalsState {
  proposals: Proposal[];
  addProposal: (proposal: Proposal) => void;
  updateProposal: (id: string, updates: Partial<Proposal>) => void;
  deleteProposal: (id: string) => void;
  getProposal: (id: string) => Proposal | undefined;
}

/** Ensure items loaded from localStorage (before attrs was added) always have attrs. */
function normalizeItems(items: LineItem[]): LineItem[] {
  return items.map((i) => ({ ...i, attrs: i.attrs ?? {} }));
}

export const useProposalsStore = create<ProposalsState>()(
  persist(
    (set, get) => ({
      proposals: MOCK_PROPOSALS,
      addProposal: (proposal) =>
        set((s) => ({ proposals: [proposal, ...s.proposals] })),
      updateProposal: (id, updates) =>
        set((s) => ({
          proposals: s.proposals.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...updates,
                  items: updates.items ? normalizeItems(updates.items) : p.items,
                  updatedAt: new Date().toISOString().split("T")[0],
                }
              : p
          ),
        })),
      deleteProposal: (id) =>
        set((s) => ({ proposals: s.proposals.filter((p) => p.id !== id) })),
      getProposal: (id) => {
        const p = get().proposals.find((p) => p.id === id);
        if (!p) return undefined;
        return {
          ...p,
          company: p.company ?? "",
          customColumns: p.customColumns ?? [],
          items: normalizeItems(p.items),
        };
      },
    }),
    { name: "proposals-store" }
  )
);

export function proposalTotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export const STATUS_CONFIG: Record<
  ProposalStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-zinc-800 text-zinc-300 border-zinc-700",
  },
  sent: {
    label: "Sent",
    className: "bg-blue-900/50 text-blue-300 border-blue-700",
  },
  accepted: {
    label: "Accepted",
    className: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  },
  declined: {
    label: "Declined",
    className: "bg-red-900/50 text-red-300 border-red-700",
  },
};
