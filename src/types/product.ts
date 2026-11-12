export interface Product {
  product_id: string;
  name: string;
  category: string;
  total_quantity: number;
  // Also returned by GET /regalo/products; optional so older code is unaffected.
  unit?: string;
  barcode?: string | null;
  min_stock?: number;
  max_stock?: number;
  cost_price?: number | null; // null = ERP hasn't sent a cost price
}

export interface MissingProductType {
  id?: number;
  product_id?: string;
  staff_name?: string;
  message?: string;
}
