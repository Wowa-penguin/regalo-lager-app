import constants from "@/constants/const";
import { InvoiceNote } from "@/types/order";
import { getAuthHeaders } from "@/utils/auth";

export const fetchInvoiceNotes = async (): Promise<InvoiceNote[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/invoice-notes`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch invoice notes");
  const json = await res.json();
  return json.notes ?? [];
};

interface deleteInvoiceNotesType {
  status: string;
}

export const deleteInvoiceNotes = async (
  invoice_number: number,
): Promise<deleteInvoiceNotesType> => {
  const res = await fetch(
    `${constants.apiUrl}/regalo/invoice-notes/${invoice_number}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    },
  );
  if (!res.ok) throw new Error("Failed to delete invoice note");
  const json = await res.json();
  return json;
};
