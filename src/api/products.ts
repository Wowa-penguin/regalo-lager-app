import constants from "@/constants/const";
import { Product } from "@/types/product";
import { getAuthHeaders } from "@/utils/auth";

export const fetchProducts = async (): Promise<Product[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/products`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch products");
  const json = await res.json();
  return json.products ?? [];
};
