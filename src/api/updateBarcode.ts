import constants from "@/constants/const";
import { BarcodeMapping } from "@/types/barcode";
import { getAuthHeaders } from "@/utils/auth";

export class BarcodeConflictError extends Error {
  existing: { barcode: string; id: number; product_id: string };
  constructor(existing: { barcode: string; id: number; product_id: string }) {
    super("Barcode already exists");
    this.existing = existing;
  }
}

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
  if (res.status === 409 && json.existing) throw new BarcodeConflictError(json.existing);
  if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
  return json as BarcodeMapping;
};
