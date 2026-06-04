import constants from "@/constants/const";
import { InvoiceNote } from "@/types/order";
import { getAuthHeaders } from "@/utils/auth";

export const createInvoiceNotes = async (
  invoice_number: number,
  name: string,
): Promise<InvoiceNote> => {
  const res = await fetch(`${constants.apiUrl}/regalo/invoice-notes`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ invoice_number, name }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
  return json as InvoiceNote;
};
