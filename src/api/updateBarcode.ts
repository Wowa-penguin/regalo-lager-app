import constants from "@/constants/const";
import { BarcodeMapping } from "@/types/barcode";
import { getAuthHeaders } from "@/utils/auth";

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
  if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
  return json as BarcodeMapping;
};
