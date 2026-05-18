import { fetchOrders } from "@/api/fetchOrders";
import BarcodeScanner from "@/components/BarcodeScanner";
import useStore, { clearSession } from "@/store/useStore";
import { Order } from "@/types/order";
import { setAuthToken } from "@/utils/auth";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function Index() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);

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

  const renderOrder = ({ item }: { item: Order }) => (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.invoice_number } })}
    >
      <View style={styles.cardTop}>
        <Text style={styles.customerName} numberOfLines={1}>
          {item.customer_name}
        </Text>
        <Text style={styles.invoiceNumber}>#{item.invoice_number}</Text>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardMeta}>{item.date}</Text>
        <Text style={styles.cardTotal}>{item.total}</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.scanButton} onPress={() => setScannerVisible(true)}>
            <Text style={styles.scanButtonText}>Scan</Text>
          </Pressable>
          <Pressable onPress={handleLogout}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
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
          data={orders}
          keyExtractor={(item) => String(item.invoice_number)}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#208AEF" />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No orders found.</Text>
            </View>
          }
        />
      )}

      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={(data) => {
          setScannerVisible(false);
          console.log("Scanned:", data);
        }}
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  scanButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  logoutText: {
    color: "#888",
    fontSize: 14,
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
    alignItems: "center",
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
  cardTotal: {
    fontSize: 15,
    fontWeight: "600",
    color: "#208AEF",
  },
});
