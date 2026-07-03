export interface FinishedOrderLine {
  item_code: string;
  description: string;
  ordered_qty: string;
  collected_qty: string;
}

export interface FinishedOrder {
  invoice_number: number;
  customer_name: string;
  name: string;
  basket: number;
  date: string;
  lines: FinishedOrderLine[];
}
