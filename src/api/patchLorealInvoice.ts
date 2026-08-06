import constants from "@/constants/const";
import { getAuthHeaders } from "@/utils/auth";

interface PatchItem {
  id: number;
  collected_qty: number;
}

interface PatchResult {
  status: string;
  updated: number;
  missing: number[];
}

export const patchLorealInvoice = async (items: PatchItem[]): Promise<PatchResult> => {
  const res = await fetch(`${constants.apiUrl}/invoice/loreal`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error("Failed to save Loreal invoice");
  return res.json();
};
