import constants from "@/constants/const";
import { LorealInvoice, Lyko } from "@/types/invoices";
import { getAuthHeaders } from "@/utils/auth";

// ── Types ────────────────────────────────────────────────────────────────────

interface LorealPatchItem {
  id: number;
  collected_qty: number;
}

interface LorealPatchResult {
  status: string;
  updated: number;
  missing: number[];
}

// ── Lyko ─────────────────────────────────────────────────────────────────────

export const fetchInvoice = async (): Promise<Lyko[]> => {
  const res = await fetch(`${constants.apiUrl}/invoice/lyko`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch Lyko invoice");
  const json = await res.json();
  return json.invoice;
};

// ── L'Oréal ──────────────────────────────────────────────────────────────────

export const fetchLorealInvoice = async (): Promise<LorealInvoice[]> => {
  const res = await fetch(`${constants.apiUrl}/invoice/loreal`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch Loreal invoice");
  const json = await res.json();
  return json.invoice ?? json;
};

export const patchLorealInvoice = async (
  items: LorealPatchItem[],
): Promise<LorealPatchResult> => {
  const res = await fetch(`${constants.apiUrl}/invoice/loreal`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error("Failed to save Loreal invoice");
  return res.json();
};
