import constants from "@/constants/const";
import { Message } from "@/types/message";
import { getAuthHeaders } from "@/utils/auth";

export const fetchMessage = async (): Promise<Message> => {
  const res = await fetch(`${constants.apiUrl}/regalo/messages`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch message");
  const json = await res.json();
  return json.messages[0];
};
