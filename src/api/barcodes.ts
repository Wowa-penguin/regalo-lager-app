import constants from "@/constants/const";
import { BarcodeMapping } from "@/types/barcode";
import { getAuthHeaders } from "@/utils/auth";

// ── Errors ───────────────────────────────────────────────────────────────────

export class BarcodeConflictError extends Error {
  existing: { barcode: string; id: number; product_id: string };
  constructor(existing: { barcode: string; id: number; product_id: string }) {
    super("Barcode already exists");
    this.existing = existing;
  }
}

// ── Barcodes ──────────────────────────────────────────────────────────────────

export const fetchBarcodes = async (): Promise<BarcodeMapping[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/barcodes`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch barcodes");
  const json = await res.json();
  return json.barcodes ?? [];
};

export const createBarcode = async (
  barcode: string,
  product_id: string,
): Promise<BarcodeMapping> => {
  const res = await fetch(`${constants.apiUrl}/regalo/barcodes`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ barcode, product_id }),
  });
  const json = await res.json();
  if (res.status === 409 && json.existing)
    throw new BarcodeConflictError(json.existing);
  if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
  return json as BarcodeMapping;
};

export const updateBarcode = async (
  id: number,
  patch: { barcode?: string; product_id?: string },
): Promise<BarcodeMapping> => {
  const res = await fetch(`${constants.apiUrl}/regalo/barcodes/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(patch),
  });
  const json = await res.json();
  if (res.status === 409 && json.existing)
    throw new BarcodeConflictError(json.existing);
  if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
  return json as BarcodeMapping;
};
