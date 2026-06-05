import { createInvoiceNotes } from "@/api/createInvoiceNotes";
import { fetchInvoiceNotes } from "@/api/fetchInvoiceNotes";
import { fetchOrders } from "@/api/fetchOrders";
import useStore, { clearSession } from "@/store/useStore";
import { Order } from "@/types/order";
import { setAuthToken } from "@/utils/auth";
import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [zipFilter, setZipFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  if (!user.username) return <Redirect href="/login" />;

  const loadOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleLogout = async () => {
    setAuthToken(null);
    await clearSession();
    logout();
    router.replace("/login");
  };

  const activeFilterCount = [
    zipFilter,
    minPrice,
    maxPrice,
    selectedStatus,
  ].filter(Boolean).length;

  const statuses = useMemo(
    () =>
      Array.from(new Set(orders.map((o) => o.hstatus).filter(Boolean))).sort(),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    const sorted = [...orders].sort((a, b) =>
      a.customer_name.localeCompare(b.customer_name, undefined, {
        sensitivity: "base",
      }),
    );
    const q = query.trim().toLowerCase();
    const zip = zipFilter.trim().toLowerCase();
    const min = minPrice !== "" ? parseFloat(minPrice) : null;
    const max = maxPrice !== "" ? parseFloat(maxPrice) : null;

    return sorted.filter((o) => {
      if (
        q &&
        !o.customer_name.toLowerCase().includes(q) &&
        !String(o.invoice_number).includes(q)
      )
        return false;
      if (zip && !o.zip_code.toLowerCase().startsWith(zip)) return false;
      if (min !== null && !isNaN(min) && o.total < min) return false;
      if (max !== null && !isNaN(max) && o.total > max) return false;
      if (selectedStatus && o.hstatus !== selectedStatus) return false;
      return true;
    });
  }, [orders, query, zipFilter, minPrice, maxPrice, selectedStatus]);

  const pushToOrder = async (invoice_number: number) => {
    try {
      const invoiceArr = await fetchInvoiceNotes();

      const blockedBy = invoiceArr.find(
        (note) =>
          note.invoice_number === invoice_number && note.name !== user.username,
      );

      if (blockedBy) {
        Alert.alert(
          "Order in use",
          `${blockedBy.name} is currently working on this order.`,
          [{ text: "OK" }],
        );
        return;
      }

      const alreadyMine = invoiceArr.some(
        (note) =>
          note.invoice_number === invoice_number && note.name === user.username,
      );

      if (!alreadyMine) {
        await createInvoiceNotes(invoice_number, user.username);
      }

      router.push({
        pathname: "/order/[id]",
        params: { id: invoice_number },
      });
    } catch (e: unknown) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Could not open order",
      );
    }
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <Pressable
      android_ripple={{ color: "#E2DAD3" }}
      style={[styles.card, item.finished && styles.cardFinished]}
      onPress={() => pushToOrder(item.invoice_number)}
    >
      <View style={styles.cardTop}>
        <Text style={styles.customerName} numberOfLines={1}>
          {item.customer_name}
        </Text>
        <View style={styles.cardRight}>
          <Text style={styles.invoiceNumber}>#{item.invoice_number}</Text>
          <Text style={styles.cardTotal}>{item.total.toFixed(0)} kr</Text>
        </View>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardMeta}>{item.date}</Text>
        {!!item.hstatus && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{item.hstatus}</Text>
          </View>
        )}
        {item.finished && (
          <View style={styles.finishedBadge}>
            <Text style={styles.finishedBadgeText}>Finished</Text>
          </View>
        )}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Pantanir</Text>
          {orders.length > 0 && (
            <Text style={styles.headerSub}>
              {filteredOrders.length} af {orders.length}
            </Text>
          )}
          <Text style={styles.headerSub}>Notandi: {user.username}</Text>
        </View>
        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Skrá út</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Nafni eða pöntunarnúmer"
          placeholderTextColor="#bbb"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        <Pressable
          style={[
            styles.filterButton,
            activeFilterCount > 0 && styles.filterButtonActive,
          ]}
          onPress={() => setShowFilters((v) => !v)}
        >
          <Text
            style={[
              styles.filterButtonText,
              activeFilterCount > 0 && styles.filterButtonTextActive,
            ]}
          >
            {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : "Filter"}
          </Text>
        </Pressable>
      </View>

      {showFilters && (
        <View style={styles.filterPanel}>
          <View style={styles.filterRow}>
            <View style={[styles.filterField, { flex: 1 }]}>
              <Text style={styles.filterLabel}>Póstkóði</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="e.g. 101"
                placeholderTextColor="#bbb"
                value={zipFilter}
                onChangeText={setZipFilter}
                autoCorrect={false}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.filterField, { flex: 1 }]}>
              <Text style={styles.filterLabel}>Lágmarksverð</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="0"
                placeholderTextColor="#bbb"
                value={minPrice}
                onChangeText={setMinPrice}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.filterField, { flex: 1 }]}>
              <Text style={styles.filterLabel}>Hámarksverð</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="∞"
                placeholderTextColor="#bbb"
                value={maxPrice}
                onChangeText={setMaxPrice}
                keyboardType="numeric"
              />
            </View>
          </View>

          {statuses.length > 0 && (
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Staða</Text>
              <View style={styles.statusChips}>
                {statuses.map((s) => (
                  <Pressable
                    key={s}
                    style={[
                      styles.statusChip,
                      selectedStatus === s && styles.statusChipActive,
                    ]}
                    onPress={() => setSelectedStatus((v) => (v === s ? "" : s))}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        selectedStatus === s && styles.statusChipTextActive,
                      ]}
                    >
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {activeFilterCount > 0 && (
            <Pressable
              onPress={() => {
                setZipFilter("");
                setMinPrice("");
                setMaxPrice("");
                setSelectedStatus("");
              }}
            >
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </Pressable>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => loadOrders()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.invoice_number)}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadOrders(true);
              }}
              tintColor="#208AEF"
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                {query || activeFilterCount > 0
                  ? "No orders match your search."
                  : "No orders found."}
              </Text>
              {!query && activeFilterCount === 0 && (
                <Pressable
                  style={styles.fetchButton}
                  onPress={() => loadOrders()}
                >
                  <Text style={styles.fetchButtonText}>Fetch orders</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}
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
    fontSize: 12,
    color: "#aaa",
    marginTop: 1,
  },
  logoutButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoutText: {
    color: "#888",
    fontSize: 15,
    fontWeight: "500",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
    backgroundColor: "#fff",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#F7F5F2",
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: "#1a1a1a",
  },
  filterButton: {
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "#F7F5F2",
  },
  filterButtonActive: {
    borderColor: "#208AEF",
    backgroundColor: "#EBF4FF",
  },
  filterButtonText: {
    fontSize: 15,
    color: "#888",
    fontWeight: "600",
  },
  filterButtonTextActive: {
    color: "#208AEF",
  },
  filterPanel: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
    backgroundColor: "#FAFAF9",
    gap: 12,
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
  },
  filterField: {
    gap: 5,
  },
  filterLabel: {
    fontSize: 12,
    color: "#888",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: "#1a1a1a",
  },
  clearFiltersText: {
    fontSize: 14,
    color: "#208AEF",
    fontWeight: "600",
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
  fetchButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
  },
  fetchButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
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
    gap: 8,
    elevation: 1,
  },
  cardFinished: {
    backgroundColor: "#F0FFF4",
    borderColor: "#C3E6CB",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  customerName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1a1a",
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 13,
    color: "#888",
    fontWeight: "500",
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardMeta: {
    fontSize: 13,
    color: "#aaa",
    flex: 1,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  cardTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#208AEF",
  },
  statusBadge: {
    backgroundColor: "#F0F0F0",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  finishedBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  finishedBadgeText: {
    fontSize: 12,
    color: "#16A34A",
    fontWeight: "600",
  },
  statusChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  statusChip: {
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  statusChipActive: {
    borderColor: "#208AEF",
    backgroundColor: "#EBF4FF",
  },
  statusChipText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  statusChipTextActive: {
    color: "#208AEF",
  },
});
