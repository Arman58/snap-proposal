"use client";

/**
 * Minimal module-level toast system.
 *
 * Usage:
 *   import { toast } from "@/components/ui/toaster";
 *   toast("Link copied to clipboard");
 *
 * Mount <Toaster /> once in the root layout — it renders its own
 * fixed container and needs no context or props.
 */

import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { useT } from "@/lib/i18n";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "default";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

// ─── Module-level singleton store ──────────────────────────────────────────────

type Listener = (items: ToastItem[]) => void;

let _toasts: ToastItem[] = [];
const _listeners: Set<Listener> = new Set();

function _notify() {
  _listeners.forEach((l) => l([..._toasts]));
}

const DISMISS_MS = 2500;

/** Call from any client component to show a toast. */
export function toast(
  message: string,
  options?: { variant?: ToastVariant }
) {
  const id = Date.now() + Math.random(); // unique even on rapid calls
  const variant = options?.variant ?? "success";
  _toasts = [..._toasts, { id, message, variant }];
  _notify();
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    _notify();
  }, DISMISS_MS);
}

// ─── Toaster component ─────────────────────────────────────────────────────────

export function Toaster() {
  const t = useT();
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    _listeners.add(setItems);
    return () => {
      _listeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label={t("notifications")}
      className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className="
            pointer-events-auto
            flex items-center gap-3
            rounded-lg border border-zinc-700
            bg-zinc-900/95 backdrop-blur
            px-4 py-3
            shadow-2xl shadow-black/40
            text-sm font-medium text-zinc-100
            animate-toast-in
          "
        >
          {item.variant === "success" && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />
            </span>
          )}
          {item.message}
        </div>
      ))}
    </div>
  );
}
