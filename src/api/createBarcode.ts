import constants from "@/constants/const";
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
  if (!res.ok) throw new Error("Failed to save barcode mapping");
  return res.json();
};
