import constants from "@/constants/const";
import { CategoryOrder } from "@/store/useCustomSortStore";
import { getAuthHeaders } from "@/utils/auth";

export const saveSortConfig = async (categoryOrder: CategoryOrder): Promise<void> => {
  const res = await fetch(`${constants.apiUrl}/regalo/sort-config`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ categoryOrder }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `Server error ${res.status}`);
  }
};
