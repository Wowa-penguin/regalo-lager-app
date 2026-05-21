import constants from "@/constants/const";
import { getAuthHeaders } from "@/utils/auth";

export const finishOrder = async (invoiceNumber: number): Promise<void> => {
  const res = await fetch(
    `${constants.apiUrl}/regalo/orders/${invoiceNumber}/finish`,
    { method: "PATCH", headers: getAuthHeaders() }
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `Server error ${res.status}`);
  }
};
