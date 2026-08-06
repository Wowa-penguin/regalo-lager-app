import { fetchInvoice } from "@/api/fetchInvoice";
import { fetchLorealInvoice } from "@/api/fetchLorealInvoice";
import { patchLorealInvoice } from "@/api/patchLorealInvoice";
import NavMenu from "@/components/NavMenu";
import CollectQuantityModal from "@/components/sendingar/CollectQuantityModal";
import LorealCollectModal from "@/components/sendingar/LorealCollectModal";
import { useLogout } from "@/hooks/useLogout";
import useStore from "@/store/useStore";
import { LorealInvoice, Lyko } from "@/types/invoices";
import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import tabStyles from "../../styles/tabStyles";

export default function SendingarTab() {
  const user = useStore((s) => s.user);
  const handleLogout = useLogout();

  const [activeTab, setActiveTab] = useState<"lyko" | "loreal">("lyko");

  // ── Lyko state ───────────────────────────────────────────────
  const [lykoInvoices, setLykoInvoices] = useState<Lyko[]>([]);
  const [lykoLoading, setLykoLoading] = useState(true);
  const [lykoRefreshing, setLykoRefreshing] = useState(false);
  const [lykoError, setLykoError] = useState("");
  const [lykoSearch, setLykoSearch] = useState("");
  const [lykoCollectedCounts, setLykoCollectedCounts] = useState<
    Record<number, number>
  >({});
  const [lykoCollectTarget, setLykoCollectTarget] = useState<{
    item: Lyko;
    initialCount: number;
  } | null>(null);

  // ── Loreal state ─────────────────────────────────────────────
  const [lorealInvoices, setLorealInvoices] = useState<LorealInvoice[]>([]);
  const [lorealLoading, setLorealLoading] = useState(false);
  const [lorealRefreshing, setLorealRefreshing] = useState(false);
  const [lorealError, setLorealError] = useState("");
  const [lorealSearch, setLorealSearch] = useState("");
  const [lorealCounts, setLorealCounts] = useState<Record<number, number>>({});
  const [lorealCollectTarget, setLorealCollectTarget] = useState<{
    item: LorealInvoice;
    initialCount: number;
  } | null>(null);
  const [lorealSaving, setLorealSaving] = useState(false);
  const [lorealSaveError, setLorealSaveError] = useState("");
  const [lorealLoaded, setLorealLoaded] = useState(false);

  // Saved toast
  const savedAnim = useRef(new Animated.Value(0)).current;
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Effects ──────────────────────────────────────────────────
  useEffect(() => {
    if (user.username) loadLyko();
  }, [user.username]);

  useEffect(() => {
    if (activeTab === "loreal" && !lorealLoaded && user.username) {
      loadLoreal();
    }
  }, [activeTab, lorealLoaded, user.username]);

  // Guard — must come after all hooks
  if (!user.username) return <Redirect href="/login" />;

  // ── Lyko handlers ─────────────────────────────────────────────
  const loadLyko = async (silent = false) => {
    if (!silent) setLykoLoading(true);
    setLykoError("");
    try {
      const data = await fetchInvoice();
      setLykoInvoices(data);
    } catch (e: unknown) {
      setLykoError(
        e instanceof Error ? e.message : "Villa við að sækja sendingu",
      );
    } finally {
      setLykoLoading(false);
      setLykoRefreshing(false);
    }
  };

  const refreshLyko = () => {
    setLykoRefreshing(true);
    setLykoCollectedCounts({});
    loadLyko(true);
  };

  const lykoQ = lykoSearch.trim().toLowerCase();
  const filteredLyko = lykoQ
    ? lykoInvoices.filter(
        (i) =>
          i.name.toLowerCase().includes(lykoQ) ||
          i.product_id.toLowerCase().includes(lykoQ),
      )
    : lykoInvoices;

  // ── Loreal handlers ───────────────────────────────────────────
  const loadLoreal = async (silent = false) => {
    if (!silent) setLorealLoading(true);
    setLorealError("");
    try {
      const data = await fetchLorealInvoice();
      setLorealInvoices(data);
      // Seed local counts from server's collected_qty
      const seed: Record<number, number> = {};
      for (const item of data) seed[item.id] = item.collected_qty;
      setLorealCounts(seed);
      setLorealLoaded(true);
    } catch (e: unknown) {
      setLorealError(
        e instanceof Error ? e.message : "Villa við að sækja sendingu",
      );
    } finally {
      setLorealLoading(false);
      setLorealRefreshing(false);
    }
  };

  const refreshLoreal = () => {
    setLorealRefreshing(true);
    setLorealLoaded(false);
    loadLoreal(true);
  };

  const lorealQ = lorealSearch.trim().toLowerCase();
  const filteredLoreal = lorealQ
    ? lorealInvoices.filter(
        (i) =>
          i.description.toLowerCase().includes(lorealQ) ||
          i.article_no.toLowerCase().includes(lorealQ) ||
          i.brand.toLowerCase().includes(lorealQ),
      )
    : lorealInvoices;

  const showSavedToast = () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    Animated.sequence([
      Animated.timing(savedAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1400),
      Animated.timing(savedAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const saveLoreal = async () => {
    if (lorealSaving) return;
    setLorealSaving(true);
    setLorealSaveError("");
    try {
      const items = lorealInvoices.map((item) => ({
        id: item.id,
        collected_qty: lorealCounts[item.id] ?? item.collected_qty,
      }));
      await patchLorealInvoice(items);
      showSavedToast();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Villa við að vista";
      setLorealSaveError(msg);
      Alert.alert("Villa", msg);
    } finally {
      setLorealSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  const lykoCollected = lykoInvoices.filter(
    (i) => (lykoCollectedCounts[i.id] ?? 0) >= i.quantity,
  ).length;

  const lorealCollected = lorealInvoices.filter(
    (i) => (lorealCounts[i.id] ?? 0) >= i.qty,
  ).length;

  return (
    <SafeAreaView style={tabStyles.container}>
      <View style={tabStyles.header}>
        <View>
          <Text style={tabStyles.headerTitle}>Sendingar</Text>
          {activeTab === "lyko" && lykoInvoices.length > 0 && (
            <Text style={tabStyles.headerSub}>
              {lykoCollected} af {lykoInvoices.length} safnað
            </Text>
          )}
          {activeTab === "loreal" && lorealInvoices.length > 0 && (
            <Text style={tabStyles.headerSub}>
              {lorealCollected} af {lorealInvoices.length} safnað
            </Text>
          )}
        </View>
        <NavMenu onLogout={handleLogout} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === "lyko" && styles.tabActive]}
          onPress={() => setActiveTab("lyko")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "lyko" && styles.tabTextActive,
            ]}
          >
            Lyko
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "loreal" && styles.tabActive]}
          onPress={() => setActiveTab("loreal")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "loreal" && styles.tabTextActive,
            ]}
          >
            L'Oréal
          </Text>
        </Pressable>
      </View>

      {/* ── LYKO TAB ── */}
      {activeTab === "lyko" && (
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Leita að vöru..."
              placeholderTextColor="#aaa"
              value={lykoSearch}
              onChangeText={setLykoSearch}
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
          </View>

          {lykoLoading ? (
            <View style={tabStyles.centered}>
              <ActivityIndicator size="large" color="#208AEF" />
            </View>
          ) : lykoError ? (
            <View style={tabStyles.centered}>
              <Text style={tabStyles.errorText}>{lykoError}</Text>
              <Pressable
                style={tabStyles.retryButton}
                onPress={() => loadLyko()}
              >
                <Text style={tabStyles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={filteredLyko}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={tabStyles.list}
              refreshControl={
                <RefreshControl
                  refreshing={lykoRefreshing}
                  onRefresh={refreshLyko}
                  tintColor="#208AEF"
                />
              }
              renderItem={({ item }) => {
                const count = lykoCollectedCounts[item.id] ?? 0;
                const collected = count >= item.quantity;
                const partial = count > 0 && !collected;
                return (
                  <Pressable
                    style={[
                      tabStyles.card,
                      collected && styles.cardCollected,
                      partial && styles.cardPartial,
                    ]}
                    onPress={() =>
                      setLykoCollectTarget({
                        item,
                        initialCount:
                          lykoCollectedCounts[item.id] ?? item.quantity,
                      })
                    }
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
                        <Text style={styles.collectBtnTextPartial}>
                          {count}
                        </Text>
                      ) : (
                        <Text style={styles.collectBtnText}>+</Text>
                      )}
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={tabStyles.centered}>
                  <Text style={tabStyles.emptyText}>
                    Engar sendingar fundust.
                  </Text>
                </View>
              }
            />
          )}

          <CollectQuantityModal
            entry={lykoCollectTarget}
            onClose={() => setLykoCollectTarget(null)}
            onDone={(count) => {
              if (!lykoCollectTarget) return;
              setLykoCollectedCounts((prev) => ({
                ...prev,
                [lykoCollectTarget.item.id]: count,
              }));
              setLykoCollectTarget(null);
            }}
          />
        </>
      )}

      {/* ── LOREAL TAB ── */}
      {activeTab === "loreal" && (
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Leita að vöru, merki eða vörunúmeri..."
              placeholderTextColor="#aaa"
              value={lorealSearch}
              onChangeText={setLorealSearch}
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
          </View>

          {lorealLoading ? (
            <View style={tabStyles.centered}>
              <ActivityIndicator size="large" color="#208AEF" />
            </View>
          ) : lorealError ? (
            <View style={tabStyles.centered}>
              <Text style={tabStyles.errorText}>{lorealError}</Text>
              <Pressable
                style={tabStyles.retryButton}
                onPress={() => loadLoreal()}
              >
                <Text style={tabStyles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={filteredLoreal}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={[tabStyles.list, { paddingBottom: 90 }]}
              refreshControl={
                <RefreshControl
                  refreshing={lorealRefreshing}
                  onRefresh={refreshLoreal}
                  tintColor="#208AEF"
                />
              }
              renderItem={({ item }) => {
                const count = lorealCounts[item.id] ?? item.collected_qty;
                const collected = count >= item.qty;
                const partial = count > 0 && !collected;
                return (
                  <Pressable
                    style={[
                      tabStyles.card,
                      collected && styles.cardCollected,
                      partial && styles.cardPartial,
                    ]}
                    onPress={() =>
                      setLorealCollectTarget({
                        item,
                        initialCount:
                          lorealCounts[item.id] ?? item.collected_qty,
                      })
                    }
                  >
                    <View style={tabStyles.cardInfo}>
                      <Text
                        style={[
                          tabStyles.productName,
                          collected && styles.textCollected,
                        ]}
                        numberOfLines={2}
                      >
                        {item.description}
                      </Text>
                      <Text style={tabStyles.productMeta}>
                        {[item.brand, item.article_no]
                          .filter(Boolean)
                          .join(" · ")}{" "}
                        · magn: {item.qty}
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
                        <Text style={styles.collectBtnTextPartial}>
                          {count}
                        </Text>
                      ) : (
                        <Text style={styles.collectBtnText}>+</Text>
                      )}
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={tabStyles.centered}>
                  <Text style={tabStyles.emptyText}>
                    Engar sendingar fundust.
                  </Text>
                </View>
              }
            />
          )}

          {/* Save footer */}
          {!lorealLoading && !lorealError && (
            <View style={styles.saveFooter}>
              {!!lorealSaveError && (
                <Text style={styles.saveErrorText}>{lorealSaveError}</Text>
              )}
              <Pressable
                style={[styles.saveBtn, lorealSaving && styles.saveBtnDisabled]}
                onPress={saveLoreal}
                disabled={lorealSaving}
              >
                {lorealSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Vista</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Saved toast */}
          <Animated.View
            style={[styles.savedToast, { opacity: savedAnim }]}
            pointerEvents="none"
          >
            <Text style={styles.savedToastText}>✓ Vistað</Text>
          </Animated.View>

          <LorealCollectModal
            entry={lorealCollectTarget}
            onClose={() => setLorealCollectTarget(null)}
            onDone={(count) => {
              if (!lorealCollectTarget) return;
              setLorealCounts((prev) => ({
                ...prev,
                [lorealCollectTarget.item.id]: count,
              }));
              setLorealCollectTarget(null);
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#208AEF",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#aaa",
  },
  tabTextActive: {
    color: "#208AEF",
  },
  searchRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
  },
  searchInput: {
    backgroundColor: "#F2F0ED",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: "#1a1a1a",
  },
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
  saveFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E2DAD3",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  saveBtn: {
    backgroundColor: "#208AEF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  saveErrorText: {
    color: "#C0392B",
    fontSize: 13,
    textAlign: "center",
  },
  savedToast: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    backgroundColor: "#27AE60",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  savedToastText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
