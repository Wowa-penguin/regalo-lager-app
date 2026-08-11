import constants from "@/constants/const";
import { FinishedOrder } from "@/types/finishedOrder";
import { Order } from "@/types/order";
import { getAuthHeaders } from "@/utils/auth";

// ── Types ────────────────────────────────────────────────────────────────────

interface FinishLine {
  line_id: number;
  collected_qty: number;
}

// ── Orders ───────────────────────────────────────────────────────────────────

export const fetchOrders = async (): Promise<Order[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/orders`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch orders");
  const json = await res.json();
  return json.orders ?? [];
};

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

export const fetchOrdersByIds = async (ids: number[]): Promise<Order[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/orders`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch orders");
  const json = await res.json();
  const all: Order[] = json.orders ?? [];
  return all.filter((o) => ids.includes(o.invoice_number));
};

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

export const fetchAllFinishedOrders = async (): Promise<FinishedOrder[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/orders/finished`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
  return json as FinishedOrder[];
};

export const finishOrder = async (
  invoiceNumber: number,
  username: string,
  baskets: number[],
  lines: FinishLine[],
): Promise<void> => {
  const res = await fetch(
    `${constants.apiUrl}/regalo/orders/${invoiceNumber}/finish`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name: username, baskets, lines }),
    },
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `Server error ${res.status}`);
  }
};

export const unfinishOrder = async (invoiceNumber: number): Promise<void> => {
  const res = await fetch(
    `${constants.apiUrl}/regalo/orders/${invoiceNumber}/unfinish`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    },
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `Server error ${res.status}`);
  }
};
