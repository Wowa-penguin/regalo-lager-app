import constants from "@/constants/const";
import { JoinPartyResult } from "@/types/party";
import { getAuthHeaders } from "@/utils/auth";

export const joinParty = async (partyId: number, name: string): Promise<JoinPartyResult> => {
  const res = await fetch(`${constants.apiUrl}/regalo/parties/${partyId}/join`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to join party");
  return res.json();
};
