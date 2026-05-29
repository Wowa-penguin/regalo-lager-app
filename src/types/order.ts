export interface OrderLine {
  id: number;
  order: number;
  item_code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_pct: number;
  total: number;
}

export interface Order {
  invoice_number: number;
  customer_number: string;
  customer_name: string;
  address: string;
  zip_code: string;
  date: string;
  net_amount: number;
  tax: number;
  total: number;
  discount: number;
  payment_mode: string;
  hstatus: string;
  finished: boolean;
  description_text_1: string;
  description_text_2: string;
  lines?: OrderLine[];
}
