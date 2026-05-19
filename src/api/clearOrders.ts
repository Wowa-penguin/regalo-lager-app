import constants from "@/constants/const";
import { getAuthHeaders } from "@/utils/auth";

export const clearOrders = async (): Promise<void> => {
  const res = await fetch(`${constants.apiUrl}/regalo/orders/clear`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to clear orders (${res.status})`);
};
