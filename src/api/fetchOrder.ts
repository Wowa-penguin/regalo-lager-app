import constants from "@/constants/const";
import { Order } from "@/types/order";
import { getAuthHeaders } from "@/utils/auth";

export const fetchOrder = async (invoiceNumber: number): Promise<Order> => {
  const res = await fetch(`${constants.apiUrl}/regalo/orders`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch order");
  const json = await res.json();
  const order = (json.orders ?? []).find(
    (o: Order) => o.invoice_number === invoiceNumber,
  );
  if (!order) throw new Error("Order not found");
  return order;
};
