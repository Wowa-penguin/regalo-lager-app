import { fetchProducts } from "@/api/fetchProducts";
import { Product } from "@/types/product";
import { useEffect, useState } from "react";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  return { products, loading, refreshing, error, load, refresh };
}
