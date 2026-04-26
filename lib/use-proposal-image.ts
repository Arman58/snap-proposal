"use client";

import { useState, useEffect } from "react";

const IMAGES_KEY = "proposal-row-images-v1";

export function useProposalImage(id: string): string {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!id) return;
    try {
      const raw = localStorage.getItem(IMAGES_KEY);
      setSrc(raw ? (JSON.parse(raw)[id] ?? "") : "");
    } catch {
      setSrc("");
    }
  }, [id]);
  return src;
}
