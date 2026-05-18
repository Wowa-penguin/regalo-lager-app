import constants from "@/constants/const";
import { BarcodeMapping } from "@/types/barcode";
import { getAuthHeaders } from "@/utils/auth";

export const fetchBarcodes = async (): Promise<BarcodeMapping[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/barcodes`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch barcodes");
  const json = await res.json();
  return json.barcodes ?? [];
};
