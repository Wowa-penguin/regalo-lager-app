import constants from "@/constants/const";
import { getAuthHeaders } from "@/utils/auth";

export const deleteParty = async (partyId: number): Promise<void> => {
  await fetch(`${constants.apiUrl}/regalo/parties/${partyId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
};
