import constants from "@/constants/const";
import { LorealInvoice } from "@/types/invoices";
import { getAuthHeaders } from "@/utils/auth";

export const fetchLorealInvoice = async (): Promise<LorealInvoice[]> => {
  const res = await fetch(`${constants.apiUrl}/invoice/loreal`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch Loreal invoice");
  const json = await res.json();
  return json.invoice ?? json;
};
