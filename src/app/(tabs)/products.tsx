import { createBarcode } from "@/api/createBarcode";
import { fetchProducts } from "@/api/fetchProducts";
import BarcodeScanner from "@/components/BarcodeScanner";
import useBarcodeStore from "@/store/useBarcodeStore";
import useStore from "@/store/useStore";
import { Product } from "@/types/product";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProductsTab() {
  const user = useStore((s) => s.user);
  const barcodes = useBarcodeStore((s) => s.barcodes);
  const addBarcode = useBarcodeStore((s) => s.addBarcode);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const [scanningProduct, setScanningProduct] = useState<Product | null>(null);
  const [scanFeedback, setScanFeedback] = useState("");
  const [saveError, setSaveError] = useState("");
  const processingRef = useRef(false);

  if (!user.username) return <Redirect href="/login" />;

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

  const mappedIds = useMemo(
    () => new Set(barcodes.map((b) => b.product_id)),
    [barcodes],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map((p) => p.category).filter(Boolean)),
      ).sort(),
    [products],
  );

  const unregistered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (mappedIds.has(p.product_id)) return false;
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.product_id.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [products, mappedIds, query, selectedCategory]);

  const handleScanned = async (data: string) => {
    if (processingRef.current || !scanningProduct) return;
    processingRef.current = true;
    setSaveError("");
    try {
      const mapping = await createBarcode(data, scanningProduct.product_id);
      addBarcode(mapping);
      setScanFeedback(
        `✓ Saved barcode for ${scanningProduct.name || scanningProduct.product_id}`,
      );
      setScanningProduct(null);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
      processingRef.current = false;
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productMeta}>
          {item.product_id}
          {item.category ? ` · ${item.category}` : ""}
        </Text>
      </View>
      <Pressable
        style={styles.scanButton}
        onPress={() => {
          processingRef.current = false;
          setScanFeedback("");
          setSaveError("");
          setScanningProduct(item);
        }}
      >
        <Text style={styles.scanButtonText}>Scan</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Products</Text>
        <Text style={styles.headerSub}>
          {unregistered.length} without barcode
        </Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or ID…"
          placeholderTextColor="#bbb"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {categories.length > 0 && (
        <View style={styles.categoryRow}>
          <Pressable
            style={[
              styles.categoryChip,
              !selectedCategory && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory("")}
          >
            <Text
              style={[
                styles.categoryChipText,
                !selectedCategory && styles.categoryChipTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory((c) => (c === cat ? "" : cat))}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat && styles.categoryChipTextActive,
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={unregistered}
          keyExtractor={(item) => item.product_id}
          renderItem={renderProduct}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor="#208AEF"
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                {query || selectedCategory
                  ? "No products match your filters."
                  : "All products have a barcode."}
              </Text>
            </View>
          }
        />
      )}

      {!!saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{saveError}</Text>
        </View>
      )}

      <BarcodeScanner
        visible={scanningProduct !== null}
        onClose={() => setScanningProduct(null)}
        onScanned={handleScanned}
        feedback={scanFeedback}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F5F2",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  headerSub: {
    fontSize: 13,
    color: "#aaa",
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
  },
  searchInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: "#1a1a1a",
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  categoryChipActive: {
    borderColor: "#208AEF",
    backgroundColor: "#EBF4FF",
  },
  categoryChipText: {
    fontSize: 13,
    color: "#888",
    fontWeight: "500",
  },
  categoryChipTextActive: {
    color: "#208AEF",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  errorText: {
    color: "#C0392B",
    fontSize: 15,
    textAlign: "center",
  },
  retryButton: {
    borderWidth: 1,
    borderColor: "#208AEF",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: "#208AEF",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyText: {
    color: "#aaa",
    fontSize: 15,
    textAlign: "center",
  },
  list: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  productMeta: {
    fontSize: 12,
    color: "#aaa",
  },
  scanButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: "#FDECEA",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F5C6CB",
  },
  errorBannerText: {
    color: "#C0392B",
    fontSize: 13,
    textAlign: "center",
  },
});
