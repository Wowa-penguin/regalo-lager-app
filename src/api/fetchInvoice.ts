import constants from "@/constants/const";
import { Lyko } from "@/types/invoices";
import { getAuthHeaders } from "@/utils/auth";

export const fetchInvoice = async (): Promise<Lyko[]> => {
  const res = await fetch(`${constants.apiUrl}/invoice/lyko`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch message");
  const json = await res.json();
  return json.invoice;
};
