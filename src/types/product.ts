export interface Product {
  product_id: string;
  name: string;
  category: string;
  total_quantity: number;
}

export interface MissingProductType {
  id?: number;
  product_id?: string;
  staff_name?: string;
  message?: string;
}
