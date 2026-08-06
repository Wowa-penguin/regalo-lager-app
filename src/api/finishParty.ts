import constants from "@/constants/const";
import { FinishPartyResult } from "@/types/party";
import { getAuthHeaders } from "@/utils/auth";

interface FinishPartyLine {
  line_id: number;
  collected_qty: number;
}

export const finishParty = async (
  partyId: number,
  payload: { name: string; basket: number; lines: FinishPartyLine[] },
): Promise<FinishPartyResult> => {
  const res = await fetch(`${constants.apiUrl}/regalo/parties/${partyId}/finish`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to finish party");
  return res.json();
};
