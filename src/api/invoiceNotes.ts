import constants from "@/constants/const";
import { InvoiceNote } from "@/types/order";
import { getAuthHeaders } from "@/utils/auth";

// ── Invoice Notes ─────────────────────────────────────────────────────────────

export const fetchInvoiceNotes = async (): Promise<InvoiceNote[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/invoice-notes`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch invoice notes");
  const json = await res.json();
  return json.notes ?? [];
};

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

export const deleteInvoiceNotes = async (
  invoice_number: number,
): Promise<{ status: string }> => {
  const res = await fetch(
    `${constants.apiUrl}/regalo/invoice-notes/${invoice_number}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    },
  );
  if (!res.ok) throw new Error("Failed to delete invoice note");
  return res.json();
};
