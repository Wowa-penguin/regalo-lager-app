import constants from "@/constants/const";
import { getAuthToken } from "@/utils/auth";

interface LogoutPost {
  status?: string;
  detail?: string;
}

export const fetchLogout = async (): Promise<LogoutPost> => {
  const res = await fetch(`${constants.apiUrl}/regalo/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Logout failed");
  return data as LogoutPost;
};
