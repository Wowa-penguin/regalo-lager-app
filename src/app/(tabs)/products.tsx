import { createBarcode } from "@/api/createBarcode";
import BarcodeScanner from "@/components/BarcodeScanner";
import { useProducts } from "@/hooks/useProducts";
import { useZebraScanner } from "@/hooks/useZebraScanner";
import useBarcodeStore from "@/store/useBarcodeStore";
import useStore from "@/store/useStore";
import { Product } from "@/types/product";
import { Redirect } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import tabStyles from "../../styles/tabStyles";

const USE_ZEBRA = Platform.OS === "android";

export default function ProductsTab() {
  const user = useStore((s) => s.user);
  const barcodes = useBarcodeStore((s) => s.barcodes);
  const addBarcode = useBarcodeStore((s) => s.addBarcode);

  const { products, loading, refreshing, error, load, refresh } = useProducts();

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [scanningProduct, setScanningProduct] = useState<Product | null>(null);
  const [saveError, setSaveError] = useState("");
  const processingRef = useRef(false);

  if (!user.username) return <Redirect href="/login" />;

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
    const product = scanningProduct;
    setScanningProduct(null);
    try {
      const mapping = await createBarcode(data, product.product_id);
      addBarcode(mapping);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
      processingRef.current = false;
    }
  };

  useZebraScanner(!!scanningProduct, handleScanned);

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={tabStyles.card}>
      <View style={tabStyles.cardInfo}>
        <Text style={tabStyles.productName}>{item.name}</Text>
        <Text style={tabStyles.productMeta}>
          {item.product_id}
          {item.category ? ` · ${item.category}` : ""}
          {item.total_quantity ? ` | status: ${item.total_quantity}` : ""}
        </Text>
      </View>
      <Pressable
        style={styles.scanButton}
        onPress={() => {
          processingRef.current = false;
          setSaveError("");
          setScanningProduct(item);
        }}
      >
        <Text style={styles.scanButtonText}>Skrá</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={tabStyles.container}>
      <View style={tabStyles.header}>
        <Text style={tabStyles.headerTitle}>Vörur</Text>
        <Text style={tabStyles.headerSub}>
          {unregistered.length} án strikamerkis
        </Text>
      </View>

      <View style={tabStyles.searchRow}>
        <TextInput
          style={tabStyles.searchInput}
          placeholder="Leita eftir nafni eða vörukóða"
          placeholderTextColor="#bbb"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryRow}
          contentContainerStyle={styles.categoryRowContent}
          keyboardShouldPersistTaps="handled"
        >
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
              Allt
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
        </ScrollView>
      )}

      {loading ? (
        <View style={tabStyles.centered}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : error ? (
        <View style={tabStyles.centered}>
          <Text style={tabStyles.errorText}>{error}</Text>
          <Pressable style={tabStyles.retryButton} onPress={() => load()}>
            <Text style={tabStyles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={unregistered}
          keyExtractor={(item) => item.product_id}
          renderItem={renderProduct}
          contentContainerStyle={tabStyles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#208AEF"
            />
          }
          ListEmptyComponent={
            <View style={tabStyles.centered}>
              <Text style={tabStyles.emptyText}>
                {query || selectedCategory
                  ? "Engar vörur passa við síurnar þínar."
                  : "Allar vörur eru með strikamerki"}
              </Text>
            </View>
          }
        />
      )}

      {!!saveError && (
        <View style={tabStyles.errorBanner}>
          <Text style={tabStyles.errorBannerText}>{saveError}</Text>
        </View>
      )}

      {USE_ZEBRA && scanningProduct && (
        <View style={styles.scanActiveBanner}>
          <Text style={styles.scanActiveText} numberOfLines={1}>
            ⊙ {scanningProduct.name}
          </Text>
          <Pressable
            onPress={() => {
              processingRef.current = false;
              setScanningProduct(null);
            }}
          >
            <Text style={styles.scanActiveCancelText}>Hætta við</Text>
          </Pressable>
        </View>
      )}

      {!USE_ZEBRA && (
        <BarcodeScanner
          visible={scanningProduct !== null}
          onClose={() => setScanningProduct(null)}
          onScanned={handleScanned}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  categoryRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
    backgroundColor: "#fff",
    minHeight: 60,
    maxHeight: 60,
  },
  categoryRowContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  categoryChip: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#F7F5F2",
  },
  categoryChipActive: {
    borderColor: "#208AEF",
    backgroundColor: "#EBF4FF",
  },
  categoryChipText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  categoryChipTextActive: {
    color: "#208AEF",
  },
  scanButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  scanActiveBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#208AEF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  scanActiveText: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  scanActiveCancelText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "600",
  },
});
