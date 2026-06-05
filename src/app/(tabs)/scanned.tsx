import { fetchProducts } from "@/api/fetchProducts";
import { updateBarcode } from "@/api/updateBarcode";
import BarcodeScanner from "@/components/BarcodeScanner";
import useBarcodeStore from "@/store/useBarcodeStore";
import useStore from "@/store/useStore";
import { BarcodeMapping } from "@/types/barcode";
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

type ScannedItem = BarcodeMapping & {
  productName: string;
  category: string;
  total_quantity: number;
};

export default function ScannedTab() {
  const user = useStore((s) => s.user);
  const barcodes = useBarcodeStore((s) => s.barcodes);
  const updateBarcodeInStore = useBarcodeStore((s) => s.updateBarcode);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const [editingItem, setEditingItem] = useState<ScannedItem | null>(null);
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

  const scannedItems = useMemo((): ScannedItem[] => {
    const q = query.trim().toLowerCase();
    return barcodes
      .map((b) => {
        const product = products.find((p) => p.product_id === b.product_id);
        return {
          ...b,
          productName: product?.name || b.product_id,
          category: product?.category || "",
          total_quantity: product?.total_quantity || 0,
        };
      })
      .filter((item) => {
        if (!q) return true;
        return (
          item.productName.toLowerCase().includes(q) ||
          item.product_id.toLowerCase().includes(q) ||
          item.barcode.toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        a.productName.localeCompare(b.productName, undefined, {
          sensitivity: "base",
        }),
      );
  }, [barcodes, products, query]);

  const handleScanned = async (data: string) => {
    if (processingRef.current || !editingItem) return;
    processingRef.current = true;
    setSaveError("");
    const item = editingItem;
    setEditingItem(null);
    try {
      const updated = await updateBarcode(item.id, { barcode: data });
      updateBarcodeInStore(item.id, { barcode: updated.barcode });
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to update barcode");
      processingRef.current = false;
    }
  };

  const renderItem = ({ item }: { item: ScannedItem }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.productName}>{item.productName}</Text>
        <Text style={styles.productMeta}>
          {item.product_id}
          {item.category ? ` · ${item.category}` : ""}
          {item.total_quantity ? ` | status: ${item.total_quantity}` : ""}
        </Text>
        <Text style={styles.barcodeValue}>{item.barcode}</Text>
      </View>
      <Pressable
        style={styles.editButton}
        onPress={() => {
          processingRef.current = false;
          setSaveError("");
          setEditingItem(item);
        }}
      >
        <Text style={styles.editButtonText}>Edit</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Skannað</Text>
        <Text style={styles.headerSub}>{barcodes.length} skráð</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Leita eftir nafni eða vörukóða"
          placeholderTextColor="#bbb"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

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
          data={scannedItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
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
                {query
                  ? "Engar niðurstöður passa við leitina þína."
                  : "Engir strikamerki skráðir ennþá."}
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
        visible={editingItem !== null}
        onClose={() => setEditingItem(null)}
        onScanned={handleScanned}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F0ED",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 24,
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
    backgroundColor: "#fff",
  },
  searchInput: {
    backgroundColor: "#F7F5F2",
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: "#1a1a1a",
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
    borderWidth: 1.5,
    borderColor: "#208AEF",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#208AEF",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyText: {
    color: "#aaa",
    fontSize: 15,
    textAlign: "center",
  },
  list: {
    padding: 14,
    gap: 10,
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 1,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  productMeta: {
    fontSize: 13,
    color: "#aaa",
  },
  barcodeValue: {
    fontSize: 13,
    color: "#888",
    fontFamily: "monospace",
    marginTop: 2,
  },
  editButton: {
    borderWidth: 1.5,
    borderColor: "#208AEF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editButtonText: {
    color: "#208AEF",
    fontSize: 15,
    fontWeight: "700",
  },
  errorBanner: {
    backgroundColor: "#FDECEA",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#F5C6CB",
  },
  errorBannerText: {
    color: "#C0392B",
    fontSize: 14,
    textAlign: "center",
  },
});
