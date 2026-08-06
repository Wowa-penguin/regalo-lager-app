import constants from "@/constants/const";
import { Party } from "@/types/party";
import { getAuthHeaders } from "@/utils/auth";

export const createParty = async (invoiceNumber: number, name: string): Promise<Party> => {
  const res = await fetch(`${constants.apiUrl}/regalo/parties`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ invoice_number: invoiceNumber, name }),
  });
  if (!res.ok) throw new Error("Failed to create party");
  return res.json();
};
