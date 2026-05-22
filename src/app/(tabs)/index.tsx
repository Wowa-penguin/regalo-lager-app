import { clearOrders } from "@/api/clearOrders";
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
  const clearOrderProgress = useStore((s) => s.clearOrderProgress);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
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

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders(true);
  };

  const handleClear = () => {
    Alert.alert(
      "Clear all orders",
      "This will remove all orders from the server and reset all picking progress. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setClearing(true);
            try {
              await clearOrders();
              clearOrderProgress();
              setOrders([]);
            } catch (e: unknown) {
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Failed to clear orders",
              );
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
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

  const renderOrder = ({ item }: { item: Order }) => (
    <Pressable
      style={[styles.card, item.finished && styles.cardFinished]}
      onPress={() =>
        router.push({
          pathname: "/order/[id]",
          params: { id: item.invoice_number },
        })
      }
    >
      <View style={styles.cardTop}>
        <Text style={styles.customerName}>{item.customer_name}</Text>
        <View style={styles.cardRight}>
          <Text style={styles.invoiceNumber}>#{item.invoice_number}</Text>
          <Text style={styles.cardTotal}>{item.total.toFixed(2)}</Text>
          {!!item.hstatus && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{item.hstatus}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardMeta}>{item.date}</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <Pressable onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      {/* Search + Filter */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or order ID…"
          placeholderTextColor="#bbb"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
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
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Zip code</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="e.g. 101"
              placeholderTextColor="#bbb"
              value={zipFilter}
              onChangeText={setZipFilter}
              autoCorrect={false}
              clearButtonMode="while-editing"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.filterRow}>
            <View style={[styles.filterField, { flex: 1 }]}>
              <Text style={styles.filterLabel}>Min price</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="0"
                placeholderTextColor="#bbb"
                value={minPrice}
                onChangeText={setMinPrice}
                keyboardType="numeric"
                clearButtonMode="while-editing"
              />
            </View>
            <View style={[styles.filterField, { flex: 1 }]}>
              <Text style={styles.filterLabel}>Max price</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="∞"
                placeholderTextColor="#bbb"
                value={maxPrice}
                onChangeText={setMaxPrice}
                keyboardType="numeric"
                clearButtonMode="while-editing"
              />
            </View>
          </View>
          {statuses.length > 0 && (
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Status</Text>
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

      {/* Content */}
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
              onRefresh={handleRefresh}
              tintColor="#208AEF"
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                {query ? "No orders match your search." : "No orders found."}
              </Text>
              {!query && (
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

      {/* Clear button */}
      {!loading && !error && orders.length > 0 && (
        <View style={styles.footer}>
          <Pressable
            style={[styles.clearButton, clearing && styles.clearButtonDisabled]}
            onPress={handleClear}
            disabled={clearing}
          >
            {clearing ? (
              <ActivityIndicator color="#C0392B" />
            ) : (
              <Text style={styles.clearButtonText}>Clear all orders</Text>
            )}
          </Pressable>
        </View>
      )}
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
  logoutText: {
    color: "#888",
    fontSize: 14,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: "#1a1a1a",
  },
  filterButton: {
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  filterButtonActive: {
    borderColor: "#208AEF",
    backgroundColor: "#EBF4FF",
  },
  filterButtonText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  filterButtonTextActive: {
    color: "#208AEF",
  },
  filterPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
    backgroundColor: "#FAFAF9",
    gap: 10,
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
  },
  filterField: {
    gap: 4,
  },
  filterLabel: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
  },
  filterInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 14,
    color: "#1a1a1a",
  },
  clearFiltersText: {
    fontSize: 13,
    color: "#208AEF",
    fontWeight: "500",
    alignSelf: "flex-start",
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
  fetchButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  fetchButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  list: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    gap: 8,
  },
  cardFinished: {
    backgroundColor: "#F0FFF4",
    borderColor: "#C3E6CB",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    flex: 1,
    marginRight: 8,
  },
  invoiceNumber: {
    fontSize: 13,
    color: "#888",
    fontWeight: "500",
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardMeta: {
    fontSize: 13,
    color: "#aaa",
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  cardTotal: {
    fontSize: 13,
    fontWeight: "600",
    color: "#208AEF",
  },
  statusBadge: {
    backgroundColor: "#F0F0F0",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-end",
  },
  statusBadgeText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
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
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  statusChipActive: {
    borderColor: "#208AEF",
    backgroundColor: "#EBF4FF",
  },
  statusChipText: {
    fontSize: 13,
    color: "#888",
    fontWeight: "500",
  },
  statusChipTextActive: {
    color: "#208AEF",
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2DAD3",
  },
  clearButton: {
    borderWidth: 1.5,
    borderColor: "#C0392B",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  clearButtonDisabled: {
    opacity: 0.5,
  },
  clearButtonText: {
    color: "#C0392B",
    fontSize: 15,
    fontWeight: "600",
  },
});
