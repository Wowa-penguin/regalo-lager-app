import { fetchOrders } from "@/api/fetchOrders";
import useStore, { clearSession } from "@/store/useStore";
import { Order } from "@/types/order";
import { setAuthToken } from "@/utils/auth";
import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
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

export default function Index() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

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

  const filteredOrders = useMemo(() => {
    const sorted = [...orders].sort((a, b) =>
      a.customer_name.localeCompare(b.customer_name, undefined, { sensitivity: "base" })
    );
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (o) =>
        o.customer_name.toLowerCase().includes(q) ||
        String(o.invoice_number).includes(q)
    );
  }, [orders, query]);

  const renderOrder = ({ item }: { item: Order }) => (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.invoice_number } })}
    >
      <View style={styles.cardTop}>
        <Text style={styles.customerName}>
          {item.customer_name}
        </Text>
        <View style={styles.cardRight}>
          <Text style={styles.invoiceNumber}>#{item.invoice_number}</Text>
          <Text style={styles.cardTotal}>{item.total.toFixed(2)}</Text>
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

      {/* Search */}
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
      </View>

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
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#208AEF" />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                {query ? "No orders match your search." : "No orders found."}
              </Text>
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  errorText: {
    color: "#C0392B",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 16,
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
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    gap: 8,
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
});
