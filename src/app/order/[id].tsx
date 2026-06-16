import { createBarcode } from "@/api/createBarcode";
import { deleteInvoiceNotes } from "@/api/fetchInvoiceNotes";
import { fetchOrder } from "@/api/fetchOrder";
import { finishOrder } from "@/api/finishOrder";
import BarcodeScanner from "@/components/BarcodeScanner";
import AssignBarcodeModal from "@/components/order/AssignBarcodeModal";
import ManualEntryModal from "@/components/order/ManualEntryModal";
import OrderLineCard from "@/components/order/OrderLineCard";
import OverpackWarningModal from "@/components/order/OverpackWarningModal";
import WrongOrderModal from "@/components/order/WrongOrderModal";
import { useProducts } from "@/hooks/useProducts";
import { useZebraScanner } from "@/hooks/useZebraScanner";
import useBarcodeStore from "@/store/useBarcodeStore";
import useStore from "@/store/useStore";
import useCustomSortStore from "@/store/useCustomSortStore";
import { CATEGORY_ORDER } from "@/constants/const";
import { Order, OrderLine } from "@/types/order";
import { useAudioPlayer } from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EMPTY_COUNTS: Record<string, number> = {};
const EMPTY_MISSING: Record<string, number> = {};
const audioSource = require("@/assets/audio/error.mp3");

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceNumber = Number(id);
  const user = useStore((s) => s.user);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const processingRef = useRef(false);

  const { products } = useProducts();
  const player = useAudioPlayer(audioSource);

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const toastAnim = useRef(new Animated.Value(-80)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [wrongOrderProduct, setWrongOrderProduct] = useState<{
    productId: string;
    barcode: string;
  } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");
  const [manualEntryTarget, setManualEntryTarget] = useState<{
    line: OrderLine;
    initialCount: number;
  } | null>(null);
  const [overpackWarning, setOverpackWarning] = useState<{
    name: string;
    itemCode: string;
    picked: number;
    quantity: number;
    unit: string;
  } | null>(null);
  const [iosScanOpen, setIosScanOpen] = useState(false);

  const pickedCounts = useStore(
    (s) => s.pickedOrders[invoiceNumber] ?? EMPTY_COUNTS,
  );
  const missingCounts = useStore(
    (s) => s.missingOrders[invoiceNumber] ?? EMPTY_MISSING,
  );
  const setItemPicked = useStore((s) => s.setItemPicked);
  const setItemMissing = useStore((s) => s.setItemMissing);

  const categoryOrder = useCustomSortStore((s) => s.categoryOrder);

  const findProductId = useBarcodeStore((s) => s.findProductId);
  const addBarcode = useBarcodeStore((s) => s.addBarcode);
  const barcodes = useBarcodeStore((s) => s.barcodes);

  useEffect(() => {
    fetchOrder(Number(id))
      .then(setOrder)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load order"),
      )
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    return () => {
      deleteInvoiceNotes(invoiceNumber).catch(() => {});
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [invoiceNumber]);

  const playErrorSound = () => {
    player.volume = 1.0;
    player.seekTo(0);
    player.play();
  };

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

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.product_id, p])),
    [products],
  );

  const itemTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of order?.lines ?? []) {
      map.set(line.item_code, (map.get(line.item_code) ?? 0) + line.quantity);
    }
    return map;
  }, [order?.lines]);

  const attributedPicks = useMemo((): Map<OrderLine, number> => {
    if (!order?.lines) return new Map();
    const groups = new Map<string, OrderLine[]>();
    for (const line of order.lines) {
      if (!groups.has(line.item_code)) groups.set(line.item_code, []);
      groups.get(line.item_code)!.push(line);
    }
    const result = new Map<OrderLine, number>();
    for (const [itemCode, group] of groups) {
      let remaining = pickedCounts[itemCode] ?? 0;
      for (const line of group) {
        const attributed = Math.min(remaining, line.quantity);
        result.set(line, attributed);
        remaining -= attributed;
      }
    }
    return result;
  }, [order?.lines, pickedCounts]);

  const attributedMissing = useMemo((): Map<OrderLine, number> => {
    if (!order?.lines) return new Map();
    const groups = new Map<string, OrderLine[]>();
    for (const line of order.lines) {
      if (!groups.has(line.item_code)) groups.set(line.item_code, []);
      groups.get(line.item_code)!.push(line);
    }
    const result = new Map<OrderLine, number>();
    for (const [itemCode, group] of groups) {
      let remaining = missingCounts[itemCode] ?? 0;
      for (const line of group) {
        const capacity = Math.max(0, line.quantity - (attributedPicks.get(line) ?? 0));
        const attributed = Math.min(remaining, capacity);
        result.set(line, attributed);
        remaining -= attributed;
      }
    }
    return result;
  }, [order?.lines, missingCounts, attributedPicks]);

  const lines = useMemo(() => {
    const priority = (line: OrderLine) => {
      const picked = attributedPicks.get(line) ?? 0;
      const missing = attributedMissing.get(line) ?? 0;
      if (picked >= line.quantity) return 1;
      if (missing > 0 && picked === 0) return 3;
      if (missing > 0 && picked > 0) return 2;
      return 0;
    };
    return [...(order?.lines ?? [])].sort((a, b) => {
      const pa = priority(a);
      const pb = priority(b);
      if (pa !== pb) return pa - pb;

      const pA = productMap.get(a.item_code);
      const pB = productMap.get(b.item_code);
      const catA = pA?.category ?? "";
      const catB = pB?.category ?? "";

      // Category order from CATEGORY_ORDER constant
      const catIdxA = CATEGORY_ORDER.indexOf(catA);
      const catIdxB = CATEGORY_ORDER.indexOf(catB);
      const catPosA = catIdxA === -1 ? Infinity : catIdxA;
      const catPosB = catIdxB === -1 ? Infinity : catIdxB;
      if (catPosA !== catPosB) return catPosA - catPosB;

      // Within same category: custom scan order takes precedence
      const customA = categoryOrder[catA];
      const customB = categoryOrder[catB];
      const posA = customA ? customA.indexOf(a.item_code) : -1;
      const posB = customB ? customB.indexOf(b.item_code) : -1;
      if (posA !== -1 && posB !== -1) return posA - posB;
      if (posA !== -1) return -1;
      if (posB !== -1) return 1;

      // Fallback: category name then product name alphabetically
      const byCategory = catA.localeCompare(catB, undefined, { sensitivity: "base" });
      if (byCategory !== 0) return byCategory;
      const nameA = pA?.name || a.description || a.item_code;
      const nameB = pB?.name || b.description || b.item_code;
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    });
  }, [order?.lines, productMap, attributedPicks, attributedMissing, categoryOrder]);

  const mappedProductIds = useMemo(
    () => new Set(barcodes.map((b) => b.product_id)),
    [barcodes],
  );

  const assignableLines = useMemo(
    () =>
      lines.filter(
        (l) =>
          (pickedCounts[l.item_code] ?? 0) === 0 &&
          !mappedProductIds.has(l.item_code),
      ),
    [lines, pickedCounts, mappedProductIds],
  );

  const completedLines = lines.filter(
    (l) => (attributedPicks.get(l) ?? 0) >= l.quantity,
  ).length;
  const allDone = lines.length > 0 && completedLines === lines.length;

  const pickItem = (line: OrderLine) => {
    const current = pickedCounts[line.item_code] ?? 0;
    const total = itemTotals.get(line.item_code) ?? line.quantity;
    if (current >= total) {
      playErrorSound();
      setOverpackWarning({
        name: line.description || line.item_code,
        itemCode: line.item_code,
        picked: current,
        quantity: total,
        unit: line.unit,
      });
      return;
    }
    const next = current + 1;
    setItemPicked(invoiceNumber, line.item_code, next);
    if ((missingCounts[line.item_code] ?? 0) > 0) {
      setItemMissing(invoiceNumber, line.item_code, Math.max(0, total - next));
    }
    showToast(`✓  ${line.description || line.item_code}`);
  };

  const handleScanned = (data: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    if (!order?.lines) {
      processingRef.current = false;
      return;
    }

    const knownProductId = findProductId(data);
    const resolvedId = knownProductId ?? data;
    const line = order.lines.find((l) => l.item_code === resolvedId);

    if (!line) {
      if (knownProductId !== null) {
        setWrongOrderProduct({ productId: knownProductId, barcode: data });
        playErrorSound();
      } else {
        setPendingBarcode(data);
      }
      return;
    }

    pickItem(line);
    setTimeout(() => {
      processingRef.current = false;
    }, 300);
  };

  useZebraScanner(!!order && !order.finished, handleScanned);

  const handleAssign = async (line: OrderLine) => {
    if (!pendingBarcode) return;
    setAssigning(true);
    setAssignError("");
    try {
      const mapping = await createBarcode(pendingBarcode, line.item_code);
      addBarcode(mapping);
      pickItem(line);
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

  const handleFinish = async () => {
    if (!order) return;
    setFinishing(true);
    setFinishError("");
    try {
      const lines = (order.lines ?? []).map((l) => ({
        line_id: l.id,
        collected_qty: attributedPicks.get(l) ?? 0,
      }));
      await finishOrder(invoiceNumber, user.username, lines);
      setOrder((o) => (o ? { ...o, finished: true } : o));
    } catch (e: unknown) {
      setFinishError(e instanceof Error ? e.message : "Failed to finish order");
    } finally {
      setFinishing(false);
    }
  };

  const handleBackArrow = async () => {
    const res = await deleteInvoiceNotes(invoiceNumber);
    if (res.status === "deleted") {
      router.back();
    }
  };

  const closePendingBarcode = () => {
    setPendingBarcode(null);
    setAssignError("");
    processingRef.current = false;
  };

  const closeOverpack = () => {
    setOverpackWarning(null);
    processingRef.current = false;
  };

  const closeWrongOrder = () => {
    setWrongOrderProduct(null);
    processingRef.current = false;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={handleBackArrow}>
          <Text style={styles.backText}>← Til baka</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {order?.customer_name ?? `Pöntun #${id}`}
        </Text>
        <Pressable
          style={[
            styles.finishButton,
            order?.finished && styles.finishButtonDone,
            finishing && styles.finishButtonDisabled,
          ]}
          onPress={handleFinish}
          disabled={finishing || order?.finished}
        >
          {finishing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.finishButtonText}>
              {order?.finished ? "Lokið" : "Klára"}
            </Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : order ? (
        <>
          <View
            style={[
              styles.progressBanner,
              allDone && styles.progressBannerDone,
            ]}
          >
            <Text
              style={[styles.progressText, allDone && styles.progressTextDone]}
            >
              {allDone
                ? "✓ Allir vörur komnar!"
                : `${completedLines} af ${lines.length} eftir`}
            </Text>
            {!allDone && Platform.OS === "android" && (
              <Text style={styles.scannerBadge}>⊙ Skanni virkur</Text>
            )}
          </View>

          {!!order.description_text_2 && (
            <View style={styles.noteBanner}>
              <Text style={styles.noteText}>{order.description_text_2}</Text>
            </View>
          )}

          <FlatList
            data={lines}
            keyExtractor={(item, index) =>
              item.id != null ? String(item.id) : `${item.item_code}-${index}`
            }
            renderItem={({ item }) => (
              <OrderLineCard
                line={item}
                picked={attributedPicks.get(item) ?? 0}
                missing={attributedMissing.get(item) ?? 0}
                isBarcodeMapped={mappedProductIds.has(item.item_code)}
                product={productMap.get(item.item_code)}
                onPressStatus={() =>
                  setManualEntryTarget({
                    line: item,
                    initialCount: attributedPicks.get(item) ?? 0,
                  })
                }
              />
            )}
            contentContainerStyle={[
              styles.list,
              Platform.OS !== "android" && !allDone && { paddingBottom: 110 },
            ]}
          />

          {!!finishError && (
            <View style={styles.footer}>
              <Text style={styles.finishError}>{finishError}</Text>
            </View>
          )}
        </>
      ) : null}

      <Animated.View
        style={[styles.scanToast, { transform: [{ translateY: toastAnim }] }]}
        pointerEvents="none"
      >
        <Text style={styles.scanToastText} numberOfLines={1}>
          {toastMessage}
        </Text>
      </Animated.View>

      <AssignBarcodeModal
        pendingBarcode={pendingBarcode}
        assigning={assigning}
        assignError={assignError}
        assignableLines={assignableLines}
        productMap={productMap}
        onClose={closePendingBarcode}
        onAssign={handleAssign}
      />

      <ManualEntryModal
        entry={manualEntryTarget}
        onClose={() => setManualEntryTarget(null)}
        onDone={(count) => {
          if (manualEntryTarget) {
            const { line, initialCount } = manualEntryTarget;
            const itemCode = line.item_code;
            const currentAggregate = pickedCounts[itemCode] ?? 0;
            const newAggregate = Math.max(
              0,
              currentAggregate - initialCount + count,
            );
            const total = itemTotals.get(itemCode) ?? line.quantity;
            setItemPicked(invoiceNumber, itemCode, newAggregate);
            if ((missingCounts[itemCode] ?? 0) > 0) {
              setItemMissing(
                invoiceNumber,
                itemCode,
                Math.max(0, total - newAggregate),
              );
            }
          }
          setManualEntryTarget(null);
        }}
        onMissing={(count) => {
          if (manualEntryTarget) {
            const { line, initialCount } = manualEntryTarget;
            const itemCode = line.item_code;
            const currentAggregate = pickedCounts[itemCode] ?? 0;
            const newAggregate = Math.max(
              0,
              currentAggregate - initialCount + count,
            );
            const total = itemTotals.get(itemCode) ?? line.quantity;
            const missing = total - newAggregate;
            setItemPicked(invoiceNumber, itemCode, newAggregate);
            setItemMissing(invoiceNumber, itemCode, missing > 0 ? missing : 0);
          }
          setManualEntryTarget(null);
        }}
      />

      <OverpackWarningModal warning={overpackWarning} onClose={closeOverpack} />

      <WrongOrderModal
        wrongProduct={wrongOrderProduct}
        products={products}
        onClose={closeWrongOrder}
      />

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

      {Platform.OS !== "android" && order && !order.finished && !allDone && (
        <View style={styles.fabContainer} pointerEvents="box-none">
          <Pressable style={styles.fab} onPress={() => setIosScanOpen(true)}>
            <Text style={styles.fabIcon}>⊙</Text>
            <Text style={styles.fabLabel}>Skanna</Text>
          </Pressable>
        </View>
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#C0392B",
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2DAD3",
  },
  finishButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  finishButtonDone: {
    backgroundColor: "#27AE60",
  },
  finishButtonDisabled: {
    opacity: 0.6,
  },
  finishButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  finishError: {
    color: "#C0392B",
    fontSize: 13,
    textAlign: "center",
  },
  progressBanner: {
    backgroundColor: "#EBF5FF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#D0E8F8",
  },
  progressBannerDone: {
    backgroundColor: "#F0FFF4",
    borderBottomColor: "#C3E6CB",
  },
  progressText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#208AEF",
    textAlign: "center",
  },
  progressTextDone: {
    color: "#27AE60",
  },
  scannerBadge: {
    fontSize: 12,
    color: "#27AE60",
    textAlign: "center",
    marginTop: 2,
  },
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
  list: {
    padding: 14,
    gap: 10,
  },
  noteBanner: {
    backgroundColor: "#FFFBE6",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#FFE58F",
  },
  noteText: {
    fontSize: 14,
    color: "#7C5800",
    fontWeight: "500",
  },
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
});
