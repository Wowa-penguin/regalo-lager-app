import constants from "@/constants/const";

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
