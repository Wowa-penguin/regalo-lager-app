import constants from "@/constants/const";
import { Order } from "@/types/order";
import { getAuthHeaders } from "@/utils/auth";

export const fetchOrdersByIds = async (ids: number[]): Promise<Order[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/orders`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch orders");
  const json = await res.json();
  const all: Order[] = json.orders ?? [];
  return all.filter((o) => ids.includes(o.invoice_number));
};
