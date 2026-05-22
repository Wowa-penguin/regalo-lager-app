import constants from "@/constants/const";
import { Order } from "@/types/order";
import { getAuthHeaders } from "@/utils/auth";

export const fetchOrders = async (): Promise<Order[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/orders`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch orders");
  const json = await res.json();
  console.log(json);
  return json.orders ?? [];
};
