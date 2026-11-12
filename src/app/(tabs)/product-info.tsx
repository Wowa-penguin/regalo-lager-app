import BarcodeScanner from "@/components/BarcodeScanner";
import NavMenu from "@/components/NavMenu";
import { getCategoryName, regaloSearchUrl } from "@/constants/const";
import { useLogout } from "@/hooks/useLogout";
import { useProducts } from "@/hooks/useProducts";
import { useZebraScanner } from "@/hooks/useZebraScanner";
import useBarcodeStore from "@/store/useBarcodeStore";
import useCustomSortStore from "@/store/useCustomSortStore";
import useStore from "@/store/useStore";
import { Product } from "@/types/product";
import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
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
const MAX_RESULTS = 50;

// Stock fields are Decimal(12,4) on the server — show "12" not "12.0000".
const fmt = (value: number | string | null | undefined): string => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? String(Number(n.toFixed(2))) : "—";
};

// Icelandic money format: 12345.5 → "12.345,50 kr." (manual — Hermes' Intl
// support varies between Android builds). null/undefined → "—".
const fmtPrice = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimals = dec === "00" ? "" : `,${dec}`;
  return `${n < 0 ? "-" : ""}${grouped}${decimals} kr.`;
};

export default function ProductInfoTab() {
  const user = useStore((s) => s.user);
  const handleLogout = useLogout();
  const barcodes = useBarcodeStore((s) => s.barcodes);
  const findProductId = useBarcodeStore((s) => s.findProductId);
  const categoryOrder = useCustomSortStore((s) => s.categoryOrder);
  const { products, loading, refreshing, error, load, refresh } = useProducts();

  const [query, setQuery] = useState("");
  // Keep the id, not the object, so a refresh shows fresh stock numbers.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.product_id, p])),
    [products],
  );

  const selected = selectedId ? (productById.get(selectedId) ?? null) : null;

  const results = useMemo((): Product[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.product_id.toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q),
      )
      .slice(0, MAX_RESULTS);
  }, [products, query]);

  const select = (product: Product) => {
    setSelectedId(product.product_id);
    setNotFound(null);
    setQuery("");
    Keyboard.dismiss();
  };

  // Same resolution order as picking: app barcode mapping → ERP barcode →
  // the scanned text is itself a product number.
  const handleScanned = (code: string) => {
    setScanOpen(false);
    const data = code.trim();
    const mappedId = findProductId(data);
    const product =
      (mappedId ? productById.get(mappedId) : undefined) ??
      products.find((p) => p.barcode === data) ??
      productById.get(data);

    if (product) {
      select(product);
    } else {
      setSelectedId(null);
      setNotFound(data);
      setQuery("");
      Keyboard.dismiss();
    }
  };

  useZebraScanner(!loading && products.length > 0, handleScanned);

  if (!user.username) return <Redirect href="/login" />;

  const renderResult = ({ item }: { item: Product }) => (
    <Pressable style={tabStyles.card} onPress={() => select(item)}>
      <View style={tabStyles.cardInfo}>
        <Text style={tabStyles.productName}>{item.name || item.product_id}</Text>
        <Text style={tabStyles.productMeta}>
          {item.product_id} · {getCategoryName(item.category)} · magn:{" "}
          {fmt(item.total_quantity)}
        </Text>
      </View>
    </Pressable>
  );

  const renderDetail = (p: Product) => {
    const mapped = barcodes.filter((b) => b.product_id === p.product_id);
    const sortList = categoryOrder[p.category];
    const sortPos = sortList ? sortList.indexOf(p.product_id) : -1;
    const stock = Number(p.total_quantity ?? 0);
    const categoryName = getCategoryName(p.category);

    return (
      <View style={styles.detailCard}>
        <Text style={styles.detailName}>{p.name || p.product_id}</Text>
        <Text style={styles.detailId}>{p.product_id}</Text>

        <View style={[styles.stockBox, stock > 0 ? styles.stockOk : styles.stockEmpty]}>
          <Text style={styles.stockLabel}>Magn á lager</Text>
          <Text style={[styles.stockValue, stock > 0 ? styles.stockValueOk : styles.stockValueEmpty]}>
            {fmt(p.total_quantity)} {p.unit ?? ""}
          </Text>
        </View>

        <InfoRow
          label="Flokkur"
          value={
            p.category
              ? categoryName === p.category
                ? p.category
                : `${categoryName} (${p.category})`
              : "—"
          }
        />
        <InfoRow label="Kostnaðarverð" value={fmtPrice(p.cost_price)} />
        <InfoRow label="Lágmark / Hámark"value={`${fmt(p.min_stock)} / ${fmt(p.max_stock)}`} />
        <InfoRow label="Strikamerki (ERP)" value={p.barcode || "—"} />
        <InfoRow
          label="Skráð strikamerki"
          value={
            mapped.length > 0
              ? mapped.map((b) => `✅ ${b.barcode}`).join("\n")
              : "❌ ekkert skráð"
          }
        />
        <InfoRow
          label="Röðun"
          value={sortPos !== -1 ? `${sortPos + 1} / ${sortList!.length}` : "Ekki raðað"}
          last
        />

        <Pressable
          style={styles.linkButton}
          onPress={() => WebBrowser.openBrowserAsync(regaloSearchUrl(p.product_id))}
        >
          <Text style={styles.linkButtonText}>Opna á regalo.is ↗</Text>
        </Pressable>
      </View>
    );
  };

  const renderBody = () => {
    if (loading) {
      return (
        <View style={tabStyles.centered}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      );
    }
    if (error) {
      return (
        <View style={tabStyles.centered}>
          <Text style={tabStyles.errorText}>{error}</Text>
          <Pressable style={tabStyles.retryButton} onPress={() => load()}>
            <Text style={tabStyles.retryText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    if (query.trim()) {
      return (
        <FlatList
          data={results}
          keyExtractor={(item) => item.product_id}
          renderItem={renderResult}
          contentContainerStyle={tabStyles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={tabStyles.centered}>
              <Text style={tabStyles.emptyText}>
                Engar niðurstöður passa við leitina þína.
              </Text>
            </View>
          }
        />
      );
    }
    return (
      <ScrollView
        contentContainerStyle={tabStyles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#208AEF" />
        }
      >
        {notFound !== null && (
          <View style={styles.notFoundBox}>
            <Text style={styles.notFoundTitle}>Óþekkt strikamerki</Text>
            <Text style={styles.notFoundCode}>{notFound}</Text>
            <Text style={styles.notFoundHint}>
              Leitaðu að vörunni eftir nafni eða vörukóða hér fyrir ofan.
            </Text>
          </View>
        )}
        {selected ? (
          renderDetail(selected)
        ) : notFound === null ? (
          <View style={tabStyles.centered}>
            <Text style={styles.emptyIcon}>⊙</Text>
            <Text style={tabStyles.emptyText}>Skannaðu vöru eða leitaðu</Text>
          </View>
        ) : null}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={tabStyles.container}>
      <View style={tabStyles.header}>
        <View>
          <Text style={tabStyles.headerTitle}>Vöruleit</Text>
          <Text style={tabStyles.headerSub}>{products.length} vörur</Text>
        </View>
        <NavMenu onLogout={handleLogout} />
      </View>

      <View style={[tabStyles.searchRow, styles.searchRow]}>
        <TextInput
          style={[tabStyles.searchInput, styles.searchInput]}
          placeholder="Leita eftir nafni eða vörukóða"
          placeholderTextColor="#bbb"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {!USE_ZEBRA && (
          <Pressable style={styles.scanButton} onPress={() => setScanOpen(true)}>
            <Text style={styles.scanButtonText}>Skanna</Text>
          </Pressable>
        )}
      </View>

      {renderBody()}

      {!USE_ZEBRA && (
        <BarcodeScanner
          visible={scanOpen}
          onClose={() => setScanOpen(false)}
          onScanned={handleScanned}
        />
      )}
    </SafeAreaView>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
  },
  scanButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyIcon: {
    fontSize: 48,
    color: "#ccc",
  },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    padding: 16,
    gap: 12,
    elevation: 1,
  },
  detailName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  detailId: {
    fontSize: 14,
    color: "#888",
    marginTop: -8,
  },
  stockBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stockOk: {
    backgroundColor: "#F0FFF4",
    borderColor: "#C6F6D5",
  },
  stockEmpty: {
    backgroundColor: "#FDECEA",
    borderColor: "#F5C6CB",
  },
  stockLabel: {
    fontSize: 14,
    color: "#888",
  },
  stockValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  stockValueOk: {
    color: "#27AE60",
  },
  stockValueEmpty: {
    color: "#C0392B",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EDE8E2",
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 14,
    color: "#888",
  },
  infoValue: {
    flex: 1,
    fontSize: 15,
    color: "#1a1a1a",
    fontWeight: "500",
    textAlign: "right",
  },
  linkButton: {
    backgroundColor: "#208AEF",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  linkButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  notFoundBox: {
    backgroundColor: "#FDECEA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F5C6CB",
    padding: 16,
    gap: 4,
    alignItems: "center",
  },
  notFoundTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#C0392B",
  },
  notFoundCode: {
    fontSize: 15,
    color: "#1a1a1a",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  notFoundHint: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
  },
});
