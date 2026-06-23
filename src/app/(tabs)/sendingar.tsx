import { fetchInvoice } from "@/api/fetchInvoice";
import NavMenu from "@/components/NavMenu";
import CollectQuantityModal from "@/components/sendingar/CollectQuantityModal";
import { useLogout } from "@/hooks/useLogout";
import useStore from "@/store/useStore";
import { Lyko } from "@/types/invoices";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import tabStyles from "../../styles/tabStyles";

export default function SendingarTab() {
  const user = useStore((s) => s.user);
  const handleLogout = useLogout();

  const [invoices, setInvoices] = useState<Lyko[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [collectedCounts, setCollectedCounts] = useState<Record<number, number>>({});
  const [collectTarget, setCollectTarget] = useState<{
    item: Lyko;
    initialCount: number;
  } | null>(null);

  if (!user.username) return <Redirect href="/login" />;

  const loadInvoices = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await fetchInvoice();
      setInvoices(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user.username) loadInvoices();
  }, [user.username]);

  const refresh = () => {
    setRefreshing(true);
    setCollectedCounts({});
    loadInvoices(true);
  };

  const openCollectModal = (item: Lyko) => {
    setCollectTarget({ item, initialCount: collectedCounts[item.id] ?? item.quantity });
  };

  const confirmCollect = (count: number) => {
    if (!collectTarget) return;
    setCollectedCounts((prev) => ({ ...prev, [collectTarget.item.id]: count }));
    setCollectTarget(null);
  };

  return (
    <SafeAreaView style={tabStyles.container}>
      <View style={tabStyles.header}>
        <View>
          <Text style={tabStyles.headerTitle}>Sendingar</Text>
          {invoices.length > 0 && (
            <Text style={tabStyles.headerSub}>
              {invoices.filter((i) => (collectedCounts[i.id] ?? 0) >= i.quantity).length} af{" "}
              {invoices.length} safnað
            </Text>
          )}
        </View>
        <NavMenu onLogout={handleLogout} />
      </View>

      {loading ? (
        <View style={tabStyles.centered}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : error ? (
        <View style={tabStyles.centered}>
          <Text style={tabStyles.errorText}>{error}</Text>
          <Pressable style={tabStyles.retryButton} onPress={() => loadInvoices()}>
            <Text style={tabStyles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={tabStyles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#208AEF"
            />
          }
          renderItem={({ item }) => {
            const count = collectedCounts[item.id] ?? 0;
            const collected = count >= item.quantity;
            const partial = count > 0 && !collected;
            return (
              <Pressable
                style={[
                  tabStyles.card,
                  collected && styles.cardCollected,
                  partial && styles.cardPartial,
                ]}
                onPress={() => openCollectModal(item)}
              >
                <View style={tabStyles.cardInfo}>
                  <Text
                    style={[
                      tabStyles.productName,
                      collected && styles.textCollected,
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Text style={tabStyles.productMeta}>
                    {item.product_id} · magn: {item.quantity}
                  </Text>
                </View>
                <View
                  style={[
                    styles.collectBtn,
                    collected && styles.collectBtnDone,
                    partial && styles.collectBtnPartial,
                  ]}
                >
                  {collected ? (
                    <Text style={styles.collectBtnTextDone}>✓</Text>
                  ) : partial ? (
                    <Text style={styles.collectBtnTextPartial}>{count}</Text>
                  ) : (
                    <Text style={styles.collectBtnText}>+</Text>
                  )}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={tabStyles.centered}>
              <Text style={tabStyles.emptyText}>Engar sendingar fundust.</Text>
            </View>
          }
        />
      )}

      <CollectQuantityModal
        entry={collectTarget}
        onClose={() => setCollectTarget(null)}
        onDone={confirmCollect}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cardCollected: {
    backgroundColor: "#F0FFF4",
    borderColor: "#C3E6CB",
  },
  cardPartial: {
    backgroundColor: "#EBF5FF",
    borderColor: "#BEE3F8",
  },
  textCollected: {
    color: "#27AE60",
  },
  collectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#208AEF",
    alignItems: "center",
    justifyContent: "center",
  },
  collectBtnDone: {
    backgroundColor: "#27AE60",
    borderColor: "#27AE60",
  },
  collectBtnPartial: {
    backgroundColor: "#208AEF",
  },
  collectBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#208AEF",
  },
  collectBtnTextPartial: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  collectBtnTextDone: {
    color: "#fff",
  },
});
