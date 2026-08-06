export interface Party {
  party_id: number;
  invoice_number: number;
  customer_name?: string;
  owner: string;
  joiner: string | null;
  status: "open" | "active" | "finished" | "cancelled";
  owner_lines?: number[];
  joiner_lines?: number[];
  created_at?: string;
}

export interface JoinPartyResult {
  party_id: number;
  invoice_number: number;
  owner: string;
  joiner: string;
  status: "active";
  your_lines: number[];
}

export interface FinishPartyResult {
  status: "partial" | "finished";
}
