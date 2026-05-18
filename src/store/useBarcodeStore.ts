import { BarcodeMapping } from "@/types/barcode";
import { create } from "zustand";

interface BarcodeState {
  barcodes: BarcodeMapping[];
  setBarcodes: (barcodes: BarcodeMapping[]) => void;
  addBarcode: (barcode: BarcodeMapping) => void;
  findProductId: (barcode: string) => string | null;
}

const useBarcodeStore = create<BarcodeState>((set, get) => ({
  barcodes: [],

  setBarcodes: (barcodes) => set({ barcodes }),

  addBarcode: (barcode) =>
    set((state) => ({ barcodes: [...state.barcodes, barcode] })),

  findProductId: (barcode) =>
    get().barcodes.find((b) => b.barcode === barcode)?.product_id ?? null,
}));

export default useBarcodeStore;
