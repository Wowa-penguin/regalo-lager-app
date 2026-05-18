export interface OrderLine {
  id: number;
  order: number;
  item_code: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  discount_pct: string;
  total: string;
}

export interface Order {
  invoice_number: number;
  customer_number: string;
  customer_name: string;
  address: string;
  zip_code: string;
  date: string;
  net_amount: string;
  tax: string;
  total: string;
  discount: string;
  payment_mode: string;
  lines?: OrderLine[];
}
