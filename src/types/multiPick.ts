import { OrderLine } from "./order";

export interface MultiPickLine extends OrderLine {
  invoiceNumber: number;
  basketNumber: number;
}
