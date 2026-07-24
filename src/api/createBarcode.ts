import constants from "@/constants/const";
import { BarcodeConflictError } from "@/api/updateBarcode";
import { BarcodeMapping } from "@/types/barcode";
import { getAuthHeaders } from "@/utils/auth";

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
  if (res.status === 409 && json.existing) throw new BarcodeConflictError(json.existing);
  if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
  return json as BarcodeMapping;
};
