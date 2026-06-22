import { createBarcode } from "@/api/createBarcode";
import { saveSortConfig } from "@/api/saveSortConfig";
import BarcodeScanner from "@/components/BarcodeScanner";
import NavMenu from "@/components/NavMenu";
import { CATEGORY_ORDER, getCategoryName } from "@/constants/const";
import { useLogout } from "@/hooks/useLogout";
import { useProducts } from "@/hooks/useProducts";
import { useZebraScanner } from "@/hooks/useZebraScanner";
import useBarcodeStore from "@/store/useBarcodeStore";
import useCustomSortStore from "@/store/useCustomSortStore";
import useStore from "@/store/useStore";
import { Product } from "@/types/product";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SortItem = {
  key: string;
  name: string;
  category: string;
};

export default function SortTab() {
  const user = useStore((s) => s.user);
  const handleLogout = useLogout();
  const { products, loading: productsLoading } = useProducts();
  const findProductId = useBarcodeStore((s) => s.findProductId);
  const addBarcode = useBarcodeStore((s) => s.addBarcode);
  const { categoryOrder, setCategoryOrder, clearCategoryOrder } =
    useCustomSortStore();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [items, setItems] = useState<SortItem[]>([]);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [iosScanOpen, setIosScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [positionTarget, setPositionTarget] = useState<SortItem | null>(null);
  const [positionInput, setPositionInput] = useState("");
  const processingRef = useRef(false);

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const toastAnim = useRef(new Animated.Value(-80)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.product_id, p])),
    [products],
  );

  const categories = useMemo(() => {
    const cats = Array.from(
      new Set(products.map((p) => p.category).filter(Boolean)),
    );
    return cats.sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }, [products]);

  // Products in the selected category, for the "assign unknown barcode" modal
  const categoryProducts = useMemo(() => {
    if (!selectedCategory) return [];
    return products
      .filter((p) => p.category === selectedCategory)
      .sort((a, b) =>
        (a.name || a.product_id).localeCompare(
          b.name || b.product_id,
          undefined,
          {
            sensitivity: "base",
          },
        ),
      );
  }, [products, selectedCategory]);

  // Load only saved/scanned items when entering a category editor
  useEffect(() => {
    if (selectedCategory === null) {
      setItems([]);
      processingRef.current = false;
      return;
    }
    const codes = categoryOrder[selectedCategory] ?? [];
    setItems(
      codes
        .map((code): SortItem | null => {
          const p = productMap.get(code);
          return p ? { key: code, name: p.name || code, category: p.category } : null;
        })
        .filter((i): i is SortItem => i !== null),
    );
  }, [selectedCategory]);

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastAnim.setValue(-80);
    Animated.spring(toastAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
    }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: -80,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 1500);
  };

  const handleScanned = (barcode: string) => {
    if (processingRef.current || !selectedCategory) return;
    processingRef.current = true;

    const productId = findProductId(barcode);

    if (productId) {
      const product = productMap.get(productId);
      if (!product) {
        showToast("Vara ekki þekkt");
        setTimeout(() => {
          processingRef.current = false;
        }, 300);
        return;
      }
      if (product.category !== selectedCategory) {
        showToast(`Vara er í flokki: ${getCategoryName(product.category)}`);
        setTimeout(() => {
          processingRef.current = false;
        }, 300);
        return;
      }
      if (items.some((i) => i.key === productId)) {
        showToast("Þegar í röðun");
        setTimeout(() => {
          processingRef.current = false;
        }, 300);
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          key: productId,
          name: product.name || productId,
          category: product.category,
        },
      ]);
      showToast(`+ ${product.name || productId}`);
      setTimeout(() => {
        processingRef.current = false;
      }, 300);
    } else {
      setPendingBarcode(barcode);
      // processingRef stays true until modal closes
    }
  };

  useZebraScanner(!!selectedCategory && !pendingBarcode, handleScanned);

  const handleAssign = async (product: Product) => {
    if (!pendingBarcode) return;
    setAssigning(true);
    setAssignError("");
    try {
      const mapping = await createBarcode(pendingBarcode, product.product_id);
      addBarcode(mapping);
      if (!items.some((i) => i.key === product.product_id)) {
        setItems((prev) => [
          ...prev,
          {
            key: product.product_id,
            name: product.name || product.product_id,
            category: product.category,
          },
        ]);
      }
      setPendingBarcode(null);
      processingRef.current = false;
    } catch (e: unknown) {
      setAssignError(
        e instanceof Error ? e.message : "Failed to save — check connection",
      );
    } finally {
      setAssigning(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCategory) return;
    setSaving(true);
    setSaveError("");
    const itemCodes = items.map((i) => i.key);
    setCategoryOrder(selectedCategory, itemCodes);
    try {
      await saveSortConfig({ ...categoryOrder, [selectedCategory]: itemCodes });
      setSelectedCategory(null);
    } catch (e: unknown) {
      setSaveError(
        e instanceof Error ? e.message : "Villa við vistun á netþjón",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      "Hreinsa röðun",
      `Hreinsa alla sérsniðna röðun fyrir „${getCategoryName(selectedCategory!)}"?`,
      [
        { text: "Hætta", style: "cancel" },
        {
          text: "Hreinsa",
          style: "destructive",
          onPress: () => {
            setItems([]);
            clearCategoryOrder(selectedCategory!);
          },
        },
      ],
    );
  };

  const handleDelete = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const closePendingBarcode = () => {
    setPendingBarcode(null);
    setAssignError("");
    processingRef.current = false;
  };

  const moveItem = (key: string, direction: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.key === key);
      if (idx === -1) return prev;
      const next = idx + direction;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const openPositionPicker = (item: SortItem, currentIndex: number) => {
    setPositionTarget(item);
    setPositionInput(String(currentIndex + 1));
  };

  const closePositionPicker = () => {
    setPositionTarget(null);
    setPositionInput("");
  };

  const confirmPosition = () => {
    if (!positionTarget) return;
    const requested = parseInt(positionInput, 10);
    if (!Number.isFinite(requested)) {
      closePositionPicker();
      return;
    }
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.key === positionTarget.key);
      if (idx === -1) return prev;
      const clamped = Math.min(Math.max(requested - 1, 0), prev.length - 1);
      if (clamped === idx) return prev;
      const arr = [...prev];
      const [moved] = arr.splice(idx, 1);
      arr.splice(clamped, 0, moved);
      return arr;
    });
    closePositionPicker();
  };

  const renderSortItem = ({ item, index }: { item: SortItem; index: number }) => (
    <View style={styles.sortRow}>
      <Pressable onPress={() => openPositionPicker(item, index)} style={styles.sortIndexBtn} hitSlop={6}>
        <Text style={styles.sortIndex}>{index + 1}</Text>
      </Pressable>
      <View style={styles.sortInfo}>
        <Text style={styles.sortName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.sortCode}>{item.key}</Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable
          onPress={() => moveItem(item.key, -1)}
          disabled={index === 0}
          style={[styles.moveBtn, index === 0 && styles.moveBtnDisabled]}
          hitSlop={6}
        >
          <Text style={styles.moveBtnText}>↑</Text>
        </Pressable>
        <Pressable
          onPress={() => moveItem(item.key, 1)}
          disabled={index === items.length - 1}
          style={[styles.moveBtn, index === items.length - 1 && styles.moveBtnDisabled]}
          hitSlop={6}
        >
          <Text style={styles.moveBtnText}>↓</Text>
        </Pressable>
        <Pressable onPress={() => handleDelete(item.key)} hitSlop={8} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );

  if (!user.username) return <Redirect href="/login" />;

  // ── Sort editor view ──────────────────────────────────────────────────────
  if (selectedCategory !== null) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => setSelectedCategory(null)}>
            <Text style={styles.backText}>← Til baka</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {getCategoryName(selectedCategory)}
          </Text>
          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Vista</Text>
            )}
          </Pressable>
        </View>

        {/* Scanner status badge (Android) */}
        {Platform.OS === "android" && (
          <View style={styles.scanBadgeRow}>
            <Text style={styles.scanBadge}>
              ⊙ Skanni virkur — hald og drag ☰ til að raða
            </Text>
          </View>
        )}

        {/* List — flex: 1 so footer stays pinned above tab bar */}
        <View style={styles.listContainer}>
          {items.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>⊙</Text>
              <Text style={styles.emptyTitle}>Engin röðun stillt</Text>
              <Text style={styles.emptyHint}>
                Skanaðu vörur í þeirri röð sem þú vilt tína þær
              </Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.key}
              renderItem={({ item, index }) => renderSortItem({ item, index })}
              contentContainerStyle={styles.sortList}
              style={styles.draggableList}
            />
          )}
        </View>

        {/* Footer actions */}
        {(items.length > 0 || !!saveError) && (
          <View style={styles.footer}>
            {!!saveError && <Text style={styles.saveError}>{saveError}</Text>}
            {items.length > 0 && (
              <Pressable style={styles.clearButton} onPress={handleClear}>
                <Text style={styles.clearButtonText}>Hreinsa allt</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Toast */}
        <Animated.View
          style={[styles.scanToast, { transform: [{ translateY: toastAnim }] }]}
          pointerEvents="none"
        >
          <Text style={styles.scanToastText} numberOfLines={1}>
            {toastMessage}
          </Text>
        </Animated.View>

        {/* iOS camera FAB */}
        {Platform.OS !== "android" && (
          <View style={styles.fabContainer} pointerEvents="box-none">
            <Pressable style={styles.fab} onPress={() => setIosScanOpen(true)}>
              <Text style={styles.fabIcon}>⊙</Text>
              <Text style={styles.fabLabel}>Skanna</Text>
            </Pressable>
          </View>
        )}

        {/* iOS camera modal */}
        {Platform.OS !== "android" && (
          <BarcodeScanner
            visible={iosScanOpen}
            onClose={() => setIosScanOpen(false)}
            onScanned={(data) => {
              setIosScanOpen(false);
              handleScanned(data);
            }}
          />
        )}

        {/* Assign unknown barcode modal */}
        <Modal
          visible={pendingBarcode !== null}
          animationType="slide"
          transparent
          onRequestClose={closePendingBarcode}
        >
          <View style={styles.overlay}>
            <SafeAreaView edges={["bottom"]} style={styles.sheet}>
              <Text style={styles.sheetTitle}>Óþekkt strikamerki</Text>
              <Text style={styles.sheetBarcode}>{pendingBarcode}</Text>
              <Text style={styles.sheetSubtitle}>Hvaða vara er þetta?</Text>

              {!!assignError && (
                <Text style={styles.assignError}>{assignError}</Text>
              )}

              <FlatList
                data={categoryProducts}
                keyExtractor={(p) => p.product_id}
                style={styles.assignList}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item: p }) => (
                  <Pressable
                    style={[
                      styles.assignCard,
                      items.some((i) => i.key === p.product_id) &&
                        styles.assignCardDisabled,
                    ]}
                    onPress={() => handleAssign(p)}
                    disabled={
                      assigning || items.some((i) => i.key === p.product_id)
                    }
                  >
                    <Text style={styles.assignName}>
                      {p.name || p.product_id}
                    </Text>
                    <Text style={styles.assignCode}>
                      {p.product_id}
                      {items.some((i) => i.key === p.product_id)
                        ? " · þegar í röðun"
                        : ""}
                    </Text>
                  </Pressable>
                )}
                ListEmptyComponent={
                  <Text style={styles.assignEmpty}>
                    Engar vörur í þessum flokki.
                  </Text>
                }
              />

              <Pressable
                style={styles.cancelButton}
                onPress={closePendingBarcode}
                disabled={assigning}
              >
                {assigning ? (
                  <ActivityIndicator color="#888" />
                ) : (
                  <Text style={styles.cancelText}>Hætta</Text>
                )}
              </Pressable>
            </SafeAreaView>
          </View>
        </Modal>

        {/* Set position modal */}
        <Modal
          visible={positionTarget !== null}
          animationType="fade"
          transparent
          onRequestClose={closePositionPicker}
        >
          <View style={styles.positionOverlay}>
            <View style={styles.positionCard}>
              <Text style={styles.positionTitle}>Setja staðsetningu</Text>
              {positionTarget && (
                <Text style={styles.positionProduct} numberOfLines={1}>
                  {positionTarget.name}
                </Text>
              )}
              <Text style={styles.positionHint}>
                Sæti (1–{items.length})
              </Text>
              <TextInput
                style={styles.positionInput}
                value={positionInput}
                onChangeText={(t) => setPositionInput(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
                onSubmitEditing={confirmPosition}
              />
              <View style={styles.positionButtons}>
                <Pressable style={styles.positionCancelBtn} onPress={closePositionPicker}>
                  <Text style={styles.positionCancelText}>Hætta</Text>
                </Pressable>
                <Pressable style={styles.positionConfirmBtn} onPress={confirmPosition}>
                  <Text style={styles.positionConfirmText}>Staðfesta</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── Category list view ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitleLarge}>Röðun</Text>
          <Text style={styles.headerSub}>Velja flokk til að stilla tíniröð</Text>
        </View>
        <NavMenu onLogout={handleLogout} />
      </View>

      {productsLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(cat) => cat}
          contentContainerStyle={styles.catList}
          renderItem={({ item: cat }) => {
            const count = categoryOrder[cat]?.length ?? 0;
            return (
              <Pressable
                style={styles.catRow}
                onPress={() => setSelectedCategory(cat)}
              >
                <View style={styles.catInfo}>
                  <Text style={styles.catName}>{getCategoryName(cat)}</Text>
                  {count > 0 ? (
                    <Text style={styles.catCount}>{count} vörur í röðun</Text>
                  ) : (
                    <Text style={styles.catCountEmpty}>Ekki stillt</Text>
                  )}
                </View>
                {count > 0 && (
                  <View style={styles.catBadge}>
                    <Text style={styles.catBadgeText}>{count}</Text>
                  </View>
                )}
                <Text style={styles.catChevron}>›</Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyHint}>Engar vörur fundust.</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
    backgroundColor: "#fff",
    gap: 12,
  },
  backText: {
    fontSize: 17,
    color: "#208AEF",
    fontWeight: "600",
    paddingVertical: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
  },
  headerTitleLarge: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  headerSub: {
    fontSize: 13,
    color: "#aaa",
  },
  saveButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    minWidth: 64,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  scanBadgeRow: {
    backgroundColor: "#F0FFF4",
    borderBottomWidth: 1,
    borderBottomColor: "#C3E6CB",
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  scanBadge: {
    fontSize: 13,
    color: "#27AE60",
    fontWeight: "600",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  emptyIcon: {
    fontSize: 40,
    color: "#D0D0D0",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#888",
  },
  emptyHint: {
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 20,
  },
  listContainer: {
    flex: 1,
  },
  draggableList: {
    flex: 1,
  },
  // Sort list
  sortList: {
    padding: 14,
    gap: 8,
  },
  sortRow: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    elevation: 1,
  },
  sortIndexBtn: {
    minWidth: 32,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#EBF4FF",
  },
  sortIndex: {
    width: 28,
    fontSize: 15,
    fontWeight: "700",
    color: "#208AEF",
    textAlign: "center",
  },
  sortInfo: {
    flex: 1,
    gap: 2,
  },
  sortName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  sortCode: {
    fontSize: 12,
    color: "#aaa",
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  moveBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F0F4FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D0E0FF",
  },
  moveBtnDisabled: {
    opacity: 0.25,
  },
  moveBtnText: {
    fontSize: 16,
    color: "#208AEF",
    fontWeight: "700",
    lineHeight: 20,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    fontSize: 14,
    color: "#C0392B",
    fontWeight: "700",
  },
  dragHandleText: {
    fontSize: 18,
    color: "#C0C0C0",
  },
  // Footer
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2DAD3",
    backgroundColor: "#fff",
  },
  saveError: {
    color: "#C0392B",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
  },
  clearButton: {
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#C0392B",
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#C0392B",
  },
  // FAB
  fabContainer: {
    position: "absolute",
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#208AEF",
    borderRadius: 32,
    paddingHorizontal: 32,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 20,
    color: "#fff",
  },
  fabLabel: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  // Toast
  scanToast: {
    position: "absolute",
    top: 26,
    left: 20,
    right: 20,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
    zIndex: 999,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  scanToastText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  // Category list
  catList: {
    padding: 14,
    gap: 10,
  },
  catRow: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 1,
  },
  catInfo: {
    flex: 1,
    gap: 3,
  },
  catName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  catCount: {
    fontSize: 13,
    color: "#27AE60",
  },
  catCountEmpty: {
    fontSize: 13,
    color: "#aaa",
  },
  catBadge: {
    backgroundColor: "#EBF4FF",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  catBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#208AEF",
  },
  catChevron: {
    fontSize: 22,
    color: "#C0C0C0",
  },
  // Assign modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    maxHeight: "80%",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  sheetBarcode: {
    fontSize: 14,
    color: "#888",
    fontFamily: "monospace",
    marginBottom: 16,
  },
  sheetSubtitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
    marginBottom: 12,
  },
  assignError: {
    color: "#C0392B",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 6,
  },
  assignList: {
    flexGrow: 0,
  },
  assignCard: {
    backgroundColor: "#F7F5F2",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2DAD3",
  },
  assignCardDisabled: {
    opacity: 0.45,
  },
  assignName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  assignCode: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 3,
  },
  assignEmpty: {
    fontSize: 15,
    color: "#aaa",
    textAlign: "center",
    paddingVertical: 20,
  },
  cancelButton: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2DAD3",
  },
  cancelText: {
    fontSize: 16,
    color: "#888",
    fontWeight: "600",
  },
  // Position picker modal
  positionOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  positionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    gap: 10,
  },
  positionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
  },
  positionProduct: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginBottom: 4,
  },
  positionHint: {
    fontSize: 13,
    color: "#aaa",
    textAlign: "center",
  },
  positionInput: {
    borderWidth: 1.5,
    borderColor: "#208AEF",
    borderRadius: 10,
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
    paddingVertical: 10,
    marginVertical: 4,
  },
  positionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  positionCancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2DAD3",
  },
  positionCancelText: {
    fontSize: 15,
    color: "#888",
    fontWeight: "600",
  },
  positionConfirmBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#208AEF",
  },
  positionConfirmText: {
    fontSize: 15,
    color: "#fff",
    fontWeight: "700",
  },
});
