import constants from "@/constants/const";
import { getAuthHeaders } from "@/utils/auth";

export interface FinishedOrderLine {
  item_code: string;
  description: string;
  ordered_qty: string;
  collected_qty: string;
}

export interface FinishedOrder {
  invoice_number: number;
  customer_name: string;
  name: string;
  date: string;
  lines: FinishedOrderLine[];
}

export const fetchFinishedOrder = async (
  invoiceNumber: number,
): Promise<FinishedOrder> => {
  const res = await fetch(
    `${constants.apiUrl}/regalo/orders/${invoiceNumber}/finish`,
    { headers: getAuthHeaders() },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
  return json as FinishedOrder;
};
