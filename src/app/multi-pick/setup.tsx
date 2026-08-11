import { createInvoiceNotes, fetchInvoiceNotes } from "@/api/invoiceNotes";
import { fetchOrders } from "@/api/orders";
import NavMenu from "@/components/NavMenu";
import { useLogout } from "@/hooks/useLogout";
import useStore from "@/store/useStore";
import { Order } from "@/types/order";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MultiPickSetup() {
  const user = useStore((s) => s.user);
  const handleLogout = useLogout();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [basketMap, setBasketMap] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user.username) return;
    fetchOrders()
      .then((data) => setOrders(data.filter((o) => !o.finished)))
      .catch((e: unknown) =>
        setError(
          e instanceof Error ? e.message : "Villa við að sækja pantanir",
        ),
      )
      .finally(() => setLoading(false));
  }, [user.username]);

  if (!user.username) return <Redirect href="/login" />;

  const availableStatuses = [
    ...new Set(orders.map((o) => o.hstatus).filter(Boolean)),
  ];

  const filteredOrders = orders.filter((o) => {
    if (filterStatus && o.hstatus !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        o.customer_name.toLowerCase().includes(q) ||
        String(o.invoice_number).includes(search.trim())
      );
    }
    return true;
  });

  const toggleSelect = async (invoiceNumber: number) => {
    if (selected.includes(invoiceNumber)) {
      setSelected((prev) => prev.filter((n) => n !== invoiceNumber));
      return;
    }
    if (selected.length >= 4) return;

    try {
      const notes = await fetchInvoiceNotes();
      const blockedBy = notes.find(
        (n) => n.invoice_number === invoiceNumber && n.name !== user.username,
      );
      if (blockedBy) {
        Alert.alert(
          "Pöntun í notkun",
          `Notandi „${blockedBy.name}" er að vinna í þessari pöntun núna.`,
          [{ text: "Í lagi" }],
        );
        return;
      }
    } catch {
      // network error — allow selection
    }

    setSelected((prev) => [...prev, invoiceNumber]);
  };

  const setBasket = (invoiceNumber: number, value: string) => {
    setBasketMap((prev) => ({ ...prev, [invoiceNumber]: value }));
  };

  const canStart =
    selected.length >= 2 &&
    selected.every((id) => {
      const v = basketMap[id];
      return v != null && v.trim() !== "" && !isNaN(parseInt(v, 10));
    });

  const startPick = async () => {
    if (!canStart || starting) return;
    setStarting(true);
    try {
      await Promise.all(
        selected.map((id) => createInvoiceNotes(id, user.username)),
      );
    } catch {
      // non-fatal — proceed even if note creation fails
    }
    const baskets: Record<number, number> = {};
    for (const id of selected) baskets[id] = parseInt(basketMap[id], 10);
    router.push({
      pathname: "/multi-pick/pick" as never,
      params: {
        ids: JSON.stringify(selected),
        baskets: JSON.stringify(baskets),
      },
    });
    setStarting(false);
  };

  const selectedOrders = orders.filter((o) =>
    selected.includes(o.invoice_number),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Fjöltínsla</Text>
          <Text style={styles.headerSub}>
            {selected.length === 0
              ? "Veldu 2–4 pantanir"
              : `${selected.length} af 4 valdar`}
          </Text>
        </View>
        <NavMenu onLogout={handleLogout} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Leita að viðskiptavini eða pöntunarnúmeri..."
          placeholderTextColor="#bbb"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {availableStatuses.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statusBarWrap}
          contentContainerStyle={styles.statusBar}
        >
          <Pressable
            style={[styles.statusTab, !filterStatus && styles.statusTabActive]}
            onPress={() => setFilterStatus(null)}
          >
            <Text
              style={[
                styles.statusTabText,
                !filterStatus && styles.statusTabTextActive,
              ]}
            >
              Allt
            </Text>
          </Pressable>
          {availableStatuses.map((s) => (
            <Pressable
              key={s}
              style={[
                styles.statusTab,
                filterStatus === s && styles.statusTabActive,
              ]}
              onPress={() => setFilterStatus((prev) => (prev === s ? null : s))}
            >
              <Text
                style={[
                  styles.statusTabText,
                  filterStatus === s && styles.statusTabTextActive,
                ]}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {filteredOrders.map((item) => {
              const isSelected = selected.includes(item.invoice_number);
              const atMax = selected.length >= 4 && !isSelected;
              return (
                <Pressable
                  key={item.invoice_number}
                  style={[
                    styles.card,
                    isSelected && styles.cardSelected,
                    atMax && styles.cardDisabled,
                  ]}
                  onPress={() => toggleSelect(item.invoice_number)}
                  disabled={atMax}
                >
                  <View style={styles.cardLeft}>
                    <Text
                      style={[
                        styles.customerName,
                        isSelected && styles.customerNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.customer_name}
                    </Text>
                    <Text style={styles.cardMeta}>
                      #{item.invoice_number} · {item.zip_code}
                    </Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.cardTotal}>
                      {(item.total ?? 0).toFixed(0)} kr
                    </Text>
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Text style={styles.checkBadgeText}>✓</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}

            {filteredOrders.length === 0 && !loading && (
              <Text style={styles.emptyText}>Engar pantanir fundust</Text>
            )}

            {selected.length >= 2 && (
              <View style={styles.basketSection}>
                <Text style={styles.basketSectionTitle}>Körfunúmer</Text>
                {selectedOrders.map((o) => (
                  <View key={o.invoice_number} style={styles.basketRow}>
                    <Text style={styles.basketRowLabel} numberOfLines={1}>
                      {o.customer_name}
                    </Text>
                    <TextInput
                      style={styles.basketInput}
                      value={basketMap[o.invoice_number] ?? ""}
                      onChangeText={(t) =>
                        setBasket(o.invoice_number, t.replace(/[^0-9]/g, ""))
                      }
                      keyboardType="number-pad"
                      placeholder="#"
                      placeholderTextColor="#bbb"
                    />
                  </View>
                ))}

                <Pressable
                  style={[
                    styles.startBtn,
                    (!canStart || starting) && styles.startBtnDisabled,
                  ]}
                  onPress={startPick}
                  disabled={!canStart || starting}
                >
                  {starting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.startBtnText}>Byrja tínslu →</Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F0ED" },
  flex: { flex: 1 },
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
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#1a1a1a" },
  headerSub: { fontSize: 12, color: "#aaa", marginTop: 1 },
  searchRow: {
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
  },
  searchInput: {
    backgroundColor: "#F2F0ED",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1a1a1a",
  },
  statusBarWrap: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
    maxHeight: 65,
  },
  statusBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: "row",
  },
  statusTab: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    backgroundColor: "#fff",
  },
  statusTabActive: {
    backgroundColor: "#208AEF",
    borderColor: "#208AEF",
  },
  statusTabText: {
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
    color: "#555",
  },
  statusTabTextActive: {
    color: "#fff",
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: {
    color: "#C0392B",
    fontSize: 15,
    textAlign: "center",
    padding: 32,
  },
  emptyText: {
    textAlign: "center",
    color: "#aaa",
    fontSize: 15,
    paddingVertical: 32,
  },
  scroll: { padding: 14, gap: 10 },
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
  cardSelected: { backgroundColor: "#EBF5FF", borderColor: "#208AEF" },
  cardDisabled: { opacity: 0.35 },
  cardLeft: { flex: 1, gap: 4 },
  customerName: { fontSize: 16, fontWeight: "600", color: "#1a1a1a" },
  customerNameSelected: { color: "#208AEF" },
  cardMeta: { fontSize: 13, color: "#aaa" },
  cardRight: { alignItems: "flex-end", gap: 6 },
  cardTotal: { fontSize: 14, fontWeight: "700", color: "#208AEF" },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#208AEF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  basketSection: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    padding: 16,
    gap: 14,
  },
  basketSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  basketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  basketRowLabel: {
    flex: 1,
    fontSize: 14,
    color: "#555",
    fontWeight: "500",
  },
  basketInput: {
    backgroundColor: "#F2F0ED",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a1a",
    minWidth: 64,
    textAlign: "center",
  },
  startBtn: {
    backgroundColor: "#208AEF",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  startBtnDisabled: { backgroundColor: "#C0C0C0" },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
