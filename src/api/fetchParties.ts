import constants from "@/constants/const";
import { Party } from "@/types/party";
import { getAuthHeaders } from "@/utils/auth";

export const fetchParties = async (): Promise<Party[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/parties`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch parties");
  const json = await res.json();
  return json.parties ?? [];
};
