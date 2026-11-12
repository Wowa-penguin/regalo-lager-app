import useProductStore from "@/store/useProductStore";
import { useEffect } from "react";

// Thin wrapper around the shared product store — every screen reads the same
// list instead of downloading its own copy. Same return shape as before.
export function useProducts() {
  const products = useProductStore((s) => s.products);
  const storeLoading = useProductStore((s) => s.loading);
  const refreshing = useProductStore((s) => s.refreshing);
  const error = useProductStore((s) => s.error);
  const neverLoaded = useProductStore((s) => s.lastFetched === null);
  const loadIfStale = useProductStore((s) => s.loadIfStale);
  const loadStore = useProductStore((s) => s.load);
  const refresh = useProductStore((s) => s.refresh);

  useEffect(() => {
    loadIfStale();
  }, [loadIfStale]);

  // Before the first fetch completes there is nothing to show — report
  // loading so screens render the spinner instead of an empty list.
  const loading = storeLoading || (neverLoaded && !error);

  const load = (silent = false) => loadStore({ silent });

  return { products, loading, refreshing, error, load, refresh };
}
