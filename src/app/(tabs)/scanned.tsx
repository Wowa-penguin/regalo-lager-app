import { updateBarcode } from "@/api/updateBarcode";
import BarcodeScanner from "@/components/BarcodeScanner";
import { useProducts } from "@/hooks/useProducts";
import { useZebraScanner } from "@/hooks/useZebraScanner";
import useBarcodeStore from "@/store/useBarcodeStore";
import useStore from "@/store/useStore";
import { BarcodeMapping } from "@/types/barcode";
import { Product } from "@/types/product";
import { Redirect } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  NativeModules,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import tabStyles from "../../styles/tabStyles";

const USE_ZEBRA = Platform.OS === "android";

type ScannedItem = BarcodeMapping & {
  productName: string;
  category: string;
  total_quantity: number;
};

export default function ScannedTab() {
  const user = useStore((s) => s.user);
  const barcodes = useBarcodeStore((s) => s.barcodes);
  const updateBarcodeInStore = useBarcodeStore((s) => s.updateBarcode);

  const { products, loading, refreshing, error, load, refresh } = useProducts();

  const [query, setQuery] = useState("");
  const [editingItem, setEditingItem] = useState<ScannedItem | null>(null);
  const [saveError, setSaveError] = useState("");
  const processingRef = useRef(false);

  if (!user.username) return <Redirect href="/login" />;

  const scannedItems = useMemo((): ScannedItem[] => {
    const q = query.trim().toLowerCase();
    return barcodes
      .map((b) => {
        const product = products.find(
          (p: Product) => p.product_id === b.product_id,
        );
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

  useZebraScanner(!!editingItem, handleScanned);

  const renderItem = ({ item }: { item: ScannedItem }) => (
    <View style={tabStyles.card}>
      <View style={tabStyles.cardInfo}>
        <Text style={tabStyles.productName}>{item.productName}</Text>
        <Text style={tabStyles.productMeta}>
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
          console.log(Platform.OS === "android");
          console.log(!!NativeModules.ZebraScan);
        }}
      >
        <Text style={styles.editButtonText}>Breyta</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={tabStyles.container}>
      <View style={tabStyles.header}>
        <Text style={tabStyles.headerTitle}>Skannað</Text>
        <Text style={tabStyles.headerSub}>{barcodes.length} skráð</Text>
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
          data={scannedItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
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
                {query
                  ? "Engar niðurstöður passa við leitina þína."
                  : "Engir strikamerki skráðir ennþá."}
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

      {USE_ZEBRA && editingItem && (
        <View style={styles.scanActiveBanner}>
          <Text style={styles.scanActiveText} numberOfLines={1}>
            ⊙ {editingItem.productName}
          </Text>
          <Pressable
            onPress={() => {
              processingRef.current = false;
              setEditingItem(null);
            }}
          >
            <Text style={styles.scanActiveCancelText}>Hætta við</Text>
          </Pressable>
        </View>
      )}

      {!USE_ZEBRA && (
        <BarcodeScanner
          visible={editingItem !== null}
          onClose={() => setEditingItem(null)}
          onScanned={handleScanned}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
