import constants from "@/constants/const";
import { FinishedOrder } from "@/types/finishedOrder";
import { getAuthHeaders } from "@/utils/auth";

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
