import { fetchProducts } from "@/api/products";
import { Product } from "@/types/product";
import { create } from "zustand";

// ERP pushes stock levels (total_quantity) every ~5 min, so cached data
// older than this is re-fetched in the background when a screen mounts.
const STALE_MS = 5 * 60 * 1000;

interface ProductState {
  products: Product[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  lastFetched: number | null;
  /** Fetch from server. `silent` skips the full-screen spinner. */
  load: (opts?: { silent?: boolean }) => Promise<void>;
  /** Pull-to-refresh. */
  refresh: () => Promise<void>;
  /** Fetch only if never loaded or older than STALE_MS. */
  loadIfStale: () => void;
  clear: () => void;
}

// Shared in-flight request so several screens mounting at once (or startup +
// a screen) trigger a single download.
let inFlight: Promise<void> | null = null;

const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  loading: false,
  refreshing: false,
  error: "",
  lastFetched: null,

  load: ({ silent = false } = {}) => {
    if (!silent) set({ loading: true, error: "" });
    if (inFlight) return inFlight;

    inFlight = fetchProducts()
      .then((products) => {
        set({ products, error: "", lastFetched: Date.now() });
      })
      .catch((e: unknown) => {
        // Keep showing the cached list if we have one; only surface the
        // error when there is nothing to show.
        if (get().products.length === 0) {
          set({
            error: e instanceof Error ? e.message : "Failed to load products",
          });
        }
      })
      .finally(() => {
        set({ loading: false, refreshing: false });
        inFlight = null;
      });
    return inFlight;
  },

  refresh: () => {
    set({ refreshing: true });
    return get().load({ silent: true });
  },

  loadIfStale: () => {
    const { lastFetched, products } = get();
    if (lastFetched === null) {
      get().load({ silent: products.length > 0 });
    } else if (Date.now() - lastFetched > STALE_MS) {
      get().load({ silent: true });
    }
  },

  clear: () =>
    set({
      products: [],
      loading: false,
      refreshing: false,
      error: "",
      lastFetched: null,
    }),
}));

export default useProductStore;
