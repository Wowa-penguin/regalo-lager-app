import constants from "@/constants/const";
import { getAuthToken } from "@/utils/auth";

// ── Types ────────────────────────────────────────────────────────────────────

interface LoginResponse {
  token: string;
  username: string;
}

interface LogoutResponse {
  status?: string;
  detail?: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const fetchLogin = async (username: string): Promise<LoginResponse> => {
  const res = await fetch(`${constants.apiUrl}/regalo/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, secret: constants.appSecret }),
  });
  const data = await res.json();
  if (res.status === 203) throw new Error(data.message);
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  return data as LoginResponse;
};

export const fetchLogout = async (): Promise<LogoutResponse> => {
  const res = await fetch(`${constants.apiUrl}/regalo/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Logout failed");
  return data as LogoutResponse;
};

export const fetchUsers = async (): Promise<string[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/users`, {
    headers: {
      "Content-Type": "application/json",
      "X-App-Secret": constants.appSecret,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch users");
  const json = await res.json();
  return json.users ?? [];
};
