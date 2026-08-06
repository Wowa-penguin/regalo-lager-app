import constants from "@/constants/const";
import { Party } from "@/types/party";
import { getAuthHeaders } from "@/utils/auth";

export const fetchParty = async (partyId: number): Promise<Party> => {
  const res = await fetch(`${constants.apiUrl}/regalo/parties/${partyId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch party");
  return res.json();
};
