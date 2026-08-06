export interface Lyko {
  id: number;
  name: string;
  quantity: number;
  product_id: string;
}

export interface LorealInvoice {
  id: number;
  brand: string;
  article_no: string;
  description: string;
  qty: number;
  collected_qty: number;
}
