import constants from "@/constants/const";

interface LoginResponse {
  token: string;
  username: string;
}

export const fetchLogin = async (
  username: string,
  password: string,
): Promise<LoginResponse> => {
  const res = await fetch(`${constants.apiUrl}/regalo/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  return data as LoginResponse;
};
