import constants from "@/constants/const";
import { getAuthHeaders } from "@/utils/auth";

interface FinishLine {
  line_id: number;
  collected_qty: number;
}

export const finishOrder = async (
  invoiceNumber: number,
  username: string,
  lines: FinishLine[],
): Promise<void> => {
  const res = await fetch(
    `${constants.apiUrl}/regalo/orders/${invoiceNumber}/finish`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name: username, lines }),
    },
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `Server error ${res.status}`);
  }
};
