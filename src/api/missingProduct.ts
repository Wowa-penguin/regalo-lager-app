import constants from "@/constants/const";
import { MissingProductType } from "@/types/product";
import { getAuthHeaders } from "@/utils/auth";

export const createMissingProduct = async (
  staffName: string,
  productId: string,
): Promise<MissingProductType> => {
  const res = await fetch(`${constants.apiUrl}/regalo/missing-product`, {
    headers: getAuthHeaders(),
    method: "POST",
    body: JSON.stringify({ product_id: productId, staff_name: staffName }),
  });
  if (!res.ok) throw new Error("Failed to create missing product");
  const json = await res.json();
  return json as MissingProductType;
};
