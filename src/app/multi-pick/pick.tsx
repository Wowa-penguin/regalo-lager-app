import { createBarcode } from "@/api/createBarcode";
import { fetchOrdersByIds } from "@/api/fetchOrdersByIds";
import { finishOrder } from "@/api/finishOrder";
import { deleteInvoiceNotes } from "@/api/fetchInvoiceNotes";
import { BarcodeConflictError, updateBarcode } from "@/api/updateBarcode";
import BarcodeScanner from "@/components/BarcodeScanner";
import AssignBarcodeModal from "@/components/order/AssignBarcodeModal";
import ManualEntryModal from "@/components/order/ManualEntryModal";
import OrderLineCard from "@/components/order/OrderLineCard";
import OverpackWarningModal from "@/components/order/OverpackWarningModal";
import { CATEGORY_ORDER } from "@/constants/const";
import { useProducts } from "@/hooks/useProducts";
import { useZebraScanner } from "@/hooks/useZebraScanner";
import useBarcodeStore from "@/store/useBarcodeStore";
import useCustomSortStore from "@/store/useCustomSortStore";
import useStore from "@/store/useStore";
import { OrderLine } from "@/types/order";
import { MultiPickLine } from "@/types/multiPick";
import { useAudioPlayer } from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const audioSource = require("@/assets/audio/error.mp3");

export default function MultiPickScreen() {
  const { ids: idsParam, baskets: basketsParam } =
    useLocalSearchParams<{ ids: string; baskets: string }>();

  const ids: number[] = useMemo(() => JSON.parse(idsParam ?? "[]"), [idsParam]);
  const basketMap: Record<number, number> = useMemo(
    () => JSON.parse(basketsParam ?? "{}"),
    [basketsParam],
  );

  const user = useStore((s) => s.user);
  const allPickedCounts = useStore((s) => s.pickedOrders);
  const allMissingCounts = useStore((s) => s.missingOrders);
  const setItemPicked = useStore((s) => s.setItemPicked);
  const setItemMissing = useStore((s) => s.setItemMissing);

  const { products } = useProducts();
  const player = useAudioPlayer(audioSource);
  const categoryOrder = useCustomSortStore((s) => s.categoryOrder);
  const findProductId = useBarcodeStore((s) => s.findProductId);
  const addBarcode = useBarcodeStore((s) => s.addBarcode);
  const updateBarcodeInStore = useBarcodeStore((s) => s.updateBarcode);
  const barcodes = useBarcodeStore((s) => s.barcodes);

  const [rawLines, setRawLines] = useState<MultiPickLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");
  const [finishProgress, setFinishProgress] = useState("");
  const [iosScanOpen, setIosScanOpen] = useState(false);
  const [changeBarcodeTarget, setChangeBarcodeTarget] =
    useState<MultiPickLine | null>(null);
  const processingRef = useRef(false);

  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState(false);
  const [manualEntryTarget, setManualEntryTarget] = useState<{
    line: MultiPickLine;
    initialCount: number;
  } | null>(null);
  const [overpackWarning, setOverpackWarning] = useState<{
    name: string;
    itemCode: string;
    invoiceNumber: number;
    picked: number;
    quantity: number;
    unit: string;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState("");
  const toastAnim = useRef(new Animated.Value(-80)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchOrdersByIds(ids)
      .then((orders) => {
        const multiLines: MultiPickLine[] = [];
        for (const order of orders) {
          const basketNumber = basketMap[order.invoice_number] ?? 0;
          for (const line of order.lines ?? []) {
            multiLines.push({
              ...line,
              invoiceNumber: order.invoice_number,
              basketNumber,
            });
          }
        }
        setRawLines(multiLines);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Villa við að sækja pantanir"),
      )
      .finally(() => setLoading(false));
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.product_id, p])),
    [products],
  );

  const mappedProductIds = useMemo(
    () => new Set(barcodes.map((b) => b.product_id)),
    [barcodes],
  );

  const itemTotalsPerOrder = useMemo(() => {
    const outer = new Map<number, Map<string, number>>();
    for (const line of rawLines) {
      if (!outer.has(line.invoiceNumber))
        outer.set(line.invoiceNumber, new Map());
      const inner = outer.get(line.invoiceNumber)!;
      inner.set(
        line.item_code,
        (inner.get(line.item_code) ?? 0) + line.quantity,
      );
    }
    return outer;
  }, [rawLines]);

  const attributedPicks = useMemo(() => {
    const result = new Map<MultiPickLine, number>();
    const byOrder = new Map<number, MultiPickLine[]>();
    for (const line of rawLines) {
      if (!byOrder.has(line.invoiceNumber)) byOrder.set(line.invoiceNumber, []);
      byOrder.get(line.invoiceNumber)!.push(line);
    }
    for (const [inv, orderLines] of byOrder) {
      const picked = allPickedCounts[inv] ?? {};
      const groups = new Map<string, MultiPickLine[]>();
      for (const line of orderLines) {
        if (!groups.has(line.item_code)) groups.set(line.item_code, []);
        groups.get(line.item_code)!.push(line);
      }
      for (const [itemCode, group] of groups) {
        let remaining = picked[itemCode] ?? 0;
        for (const line of group) {
          const attributed = Math.min(remaining, line.quantity);
          result.set(line, attributed);
          remaining -= attributed;
        }
      }
    }
    return result;
  }, [rawLines, allPickedCounts]);

  const attributedMissing = useMemo(() => {
    const result = new Map<MultiPickLine, number>();
    const byOrder = new Map<number, MultiPickLine[]>();
    for (const line of rawLines) {
      if (!byOrder.has(line.invoiceNumber)) byOrder.set(line.invoiceNumber, []);
      byOrder.get(line.invoiceNumber)!.push(line);
    }
    for (const [inv, orderLines] of byOrder) {
      const missing = allMissingCounts[inv] ?? {};
      const groups = new Map<string, MultiPickLine[]>();
      for (const line of orderLines) {
        if (!groups.has(line.item_code)) groups.set(line.item_code, []);
        groups.get(line.item_code)!.push(line);
      }
      for (const [itemCode, group] of groups) {
        let remaining = missing[itemCode] ?? 0;
        for (const line of group) {
          const capacity = Math.max(
            0,
            line.quantity - (attributedPicks.get(line) ?? 0),
          );
          const attributed = Math.min(remaining, capacity);
          result.set(line, attributed);
          remaining -= attributed;
        }
      }
    }
    return result;
  }, [rawLines, allMissingCounts, attributedPicks]);

  const lines = useMemo(() => {
    const priority = (line: MultiPickLine) => {
      const picked = attributedPicks.get(line) ?? 0;
      const missing = attributedMissing.get(line) ?? 0;
      if (picked >= line.quantity) return 1;
      if (missing > 0 && picked === 0) return 3;
      if (missing > 0 && picked > 0) return 2;
      return 0;
    };
    return [...rawLines].sort((a, b) => {
      const pa = priority(a);
      const pb = priority(b);
      if (pa !== pb) return pa - pb;

      const pA = productMap.get(a.item_code);
      const pB = productMap.get(b.item_code);
      const catA = pA?.category ?? "";
      const catB = pB?.category ?? "";

      const catIdxA = CATEGORY_ORDER.indexOf(catA);
      const catIdxB = CATEGORY_ORDER.indexOf(catB);
      const catPosA = catIdxA === -1 ? Infinity : catIdxA;
      const catPosB = catIdxB === -1 ? Infinity : catIdxB;
      if (catPosA !== catPosB) return catPosA - catPosB;

      const customA = categoryOrder[catA];
      const customB = categoryOrder[catB];
      const posA = customA ? customA.indexOf(a.item_code) : -1;
      const posB = customB ? customB.indexOf(b.item_code) : -1;
      if (posA !== -1 && posB !== -1) return posA - posB;
      if (posA !== -1) return -1;
      if (posB !== -1) return 1;

      const byCategory = catA.localeCompare(catB, undefined, {
        sensitivity: "base",
      });
      if (byCategory !== 0) return byCategory;
      const nameA = pA?.name || a.description || a.item_code;
      const nameB = pB?.name || b.description || b.item_code;
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    });
  }, [rawLines, productMap, attributedPicks, attributedMissing, categoryOrder]);

  const assignableLines = useMemo(
    () =>
      lines.filter(
        (l) =>
          (allPickedCounts[l.invoiceNumber]?.[l.item_code] ?? 0) === 0 &&
          !mappedProductIds.has(l.item_code),
      ),
    [lines, allPickedCounts, mappedProductIds],
  );

  const completedLines = lines.filter(
    (l) => (attributedPicks.get(l) ?? 0) >= l.quantity,
  ).length;
  const allDone = lines.length > 0 && completedLines === lines.length;

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

  const playErrorSound = () => {
    player.volume = 1.0;
    player.seekTo(0);
    player.play();
  };

  const pickItem = (line: MultiPickLine) => {
    const inv = line.invoiceNumber;
    const itemCode = line.item_code;
    const current = allPickedCounts[inv]?.[itemCode] ?? 0;
    const total = itemTotalsPerOrder.get(inv)?.get(itemCode) ?? line.quantity;
    if (current >= total) {
      playErrorSound();
      setOverpackWarning({
        name: line.description || itemCode,
        itemCode,
        invoiceNumber: inv,
        picked: current,
        quantity: total,
        unit: line.unit,
      });
      return;
    }
    const next = current + 1;
    setItemPicked(inv, itemCode, next);
    if ((allMissingCounts[inv]?.[itemCode] ?? 0) > 0) {
      setItemMissing(inv, itemCode, Math.max(0, total - next));
    }
    showToast(`✓ ${line.description || itemCode}`);
    setTimeout(() => {
      processingRef.current = false;
    }, 300);
  };

  const handleChangeBarcodeScanned = async (data: string) => {
    const target = changeBarcodeTarget;
    setChangeBarcodeTarget(null);
    if (!target) {
      processingRef.current = false;
      return;
    }
    try {
      const existing = barcodes.find((b) => b.product_id === target.item_code);
      if (existing) {
        const updated = await updateBarcode(existing.id, { barcode: data });
        updateBarcodeInStore(existing.id, { barcode: updated.barcode });
      } else {
        const mapping = await createBarcode(data, target.item_code);
        addBarcode(mapping);
      }
      showToast("✓ Strikamerki uppfært");
    } catch (e: unknown) {
      if (e instanceof BarcodeConflictError) {
        const conflictProduct = productMap.get(e.existing.product_id);
        const conflictName = conflictProduct?.name ?? e.existing.product_id;
        const targetName = target.description || target.item_code;
        Alert.alert(
          "Strikamerki í notkun",
          `Þetta strikamerki tilheyrir „${conflictName}". Viltu færa það yfir á „${targetName}"?`,
          [
            { text: "Hætta við", style: "cancel" },
            {
              text: "Já, færa yfir",
              onPress: async () => {
                try {
                  await updateBarcode(e.existing.id, {
                    product_id: target.item_code,
                  });
                  updateBarcodeInStore(e.existing.id, {
                    product_id: target.item_code,
                  });
                  showToast("✓ Strikamerki flutt");
                } catch (err) {
                  Alert.alert(
                    "Villa",
                    err instanceof Error ? err.message : "Failed to reassign",
                  );
                }
              },
            },
          ],
        );
      } else {
        Alert.alert(
          "Villa",
          e instanceof Error ? e.message : "Failed to update barcode",
        );
      }
    } finally {
      processingRef.current = false;
    }
  };

  const promptChangeBarcode = (line: MultiPickLine) => {
    Alert.alert(
      "Breyta strikamerki",
      `Viltu breyta strikamerki fyrir „${line.description || line.item_code}"?`,
      [
        { text: "Hætta", style: "cancel" },
        {
          text: "Já",
          onPress: () => {
            processingRef.current = false;
            setChangeBarcodeTarget(line);
            if (Platform.OS !== "android") setIosScanOpen(true);
          },
        },
      ],
    );
  };

  const cancelChangeBarcode = () => {
    setChangeBarcodeTarget(null);
    processingRef.current = false;
  };

  const handleScanned = (data: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    if (changeBarcodeTarget) {
      handleChangeBarcodeScanned(data);
      return;
    }

    const knownProductId = findProductId(data);
    const resolvedId = knownProductId ?? data;

    // Find first selected order (in param order) that still needs this item
    for (const inv of ids) {
      const total = itemTotalsPerOrder.get(inv)?.get(resolvedId) ?? 0;
      if (total === 0) continue;
      const picked = allPickedCounts[inv]?.[resolvedId] ?? 0;
      if (picked < total) {
        const line = lines.find(
          (l) => l.invoiceNumber === inv && l.item_code === resolvedId,
        );
        if (line) {
          pickItem(line);
          return;
        }
      }
    }

    if (knownProductId !== null) {
      playErrorSound();
      Alert.alert(
        "Vara ekki í pöntununum",
        "Þessi vara er ekki í neinum völdum pöntunum.",
      );
      processingRef.current = false;
    } else {
      setPendingBarcode(data);
    }
  };

  useZebraScanner(!loading && !allDone, handleScanned);

  const handleAssign = async (line: OrderLine) => {
    if (!pendingBarcode) return;
    setAssigning(true);
    const multiLine = line as MultiPickLine;
    try {
      const mapping = await createBarcode(pendingBarcode, multiLine.item_code);
      addBarcode(mapping);
      pickItem(multiLine);
      setPendingBarcode(null);
      processingRef.current = false;
    } catch (e: unknown) {
      setAssignError(true);
    } finally {
      setAssigning(false);
    }
  };

  const doFinish = async () => {
    setFinishing(true);
    setFinishError("");
    try {
      for (let i = 0; i < ids.length; i++) {
        const inv = ids[i];
        setFinishProgress(`${i + 1}/${ids.length}`);
        const orderLines = lines.filter((l) => l.invoiceNumber === inv);
        const finishLines = orderLines.map((l) => ({
          line_id: l.id,
          collected_qty: attributedPicks.get(l) ?? 0,
        }));
        await finishOrder(inv, user.username, [basketMap[inv]], finishLines);
      }
      router.back();
    } catch (e: unknown) {
      setFinishError(e instanceof Error ? e.message : "Villa við að klára");
    } finally {
      setFinishing(false);
      setFinishProgress("");
    }
  };

  const handleFinish = () => {
    if (allDone) {
      doFinish();
      return;
    }
    Alert.alert(
      "Klára tínslu?",
      "Ekki allar vörur eru kláraðar. Viltu klára samt?",
      [
        { text: "Hætta við", style: "cancel" },
        { text: "Já, klára", onPress: doFinish },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={async () => {
            await Promise.allSettled(ids.map((id) => deleteInvoiceNotes(id)));
            router.back();
          }}
        >
          <Text style={styles.backText}>← Til baka</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Fjöltínsla · {ids.length} pantanir
        </Text>
        <Pressable
          style={[styles.finishButton, finishing && styles.finishButtonDisabled]}
          onPress={handleFinish}
          disabled={finishing}
        >
          {finishing ? (
            <Text style={styles.finishButtonText}>{finishProgress}</Text>
          ) : (
            <Text style={styles.finishButtonText}>Klára allt</Text>
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
      ) : (
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
                ? "✓ Allar vörur kláraðar!"
                : `${completedLines} af ${lines.length} kláraðar`}
            </Text>
            {!allDone && Platform.OS === "android" && (
              <Text style={styles.scannerBadge}>⊙ Skanni virkur</Text>
            )}
          </View>

          <FlatList
            data={lines}
            keyExtractor={(item, index) =>
              item.id != null
                ? `${item.invoiceNumber}-${item.id}`
                : `${item.invoiceNumber}-${item.item_code}-${index}`
            }
            renderItem={({ item }) => (
              <OrderLineCard
                line={item}
                picked={attributedPicks.get(item) ?? 0}
                missing={attributedMissing.get(item) ?? 0}
                isBarcodeMapped={mappedProductIds.has(item.item_code)}
                product={productMap.get(item.item_code)}
                basketNumber={item.basketNumber}
                onPressStatus={() =>
                  setManualEntryTarget({
                    line: item,
                    initialCount:
                      allPickedCounts[item.invoiceNumber]?.[item.item_code] ??
                      0,
                  })
                }
                onPressCard={() => promptChangeBarcode(item)}
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
      )}

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
        assignError={assignError ? "Villa við að vista strikamerki" : ""}
        assignableLines={assignableLines}
        productMap={productMap}
        onClose={() => {
          setPendingBarcode(null);
          setAssignError(false);
          processingRef.current = false;
        }}
        onAssign={handleAssign}
      />

      <ManualEntryModal
        entry={manualEntryTarget}
        onClose={() => setManualEntryTarget(null)}
        onDone={(count) => {
          if (manualEntryTarget) {
            const { line, initialCount } = manualEntryTarget;
            const inv = line.invoiceNumber;
            const itemCode = line.item_code;
            const current = allPickedCounts[inv]?.[itemCode] ?? 0;
            const newAggregate = Math.max(0, current - initialCount + count);
            const total =
              itemTotalsPerOrder.get(inv)?.get(itemCode) ?? line.quantity;
            setItemPicked(inv, itemCode, newAggregate);
            if ((allMissingCounts[inv]?.[itemCode] ?? 0) > 0) {
              setItemMissing(inv, itemCode, Math.max(0, total - newAggregate));
            }
          }
          setManualEntryTarget(null);
        }}
        onMissing={(count) => {
          if (manualEntryTarget) {
            const { line, initialCount } = manualEntryTarget;
            const inv = line.invoiceNumber;
            const itemCode = line.item_code;
            const current = allPickedCounts[inv]?.[itemCode] ?? 0;
            const newAggregate = Math.max(0, current - initialCount + count);
            const total =
              itemTotalsPerOrder.get(inv)?.get(itemCode) ?? line.quantity;
            const missing = total - newAggregate;
            setItemPicked(inv, itemCode, newAggregate);
            setItemMissing(inv, itemCode, missing > 0 ? missing : 0);
          }
          setManualEntryTarget(null);
        }}
      />

      <OverpackWarningModal
        warning={
          overpackWarning
            ? {
                name: overpackWarning.name,
                itemCode: overpackWarning.itemCode,
                picked: overpackWarning.picked,
                quantity: overpackWarning.quantity,
                unit: overpackWarning.unit,
              }
            : null
        }
        onClose={() => {
          setOverpackWarning(null);
          processingRef.current = false;
        }}
      />

      {changeBarcodeTarget && (
        <View style={styles.changeBarcodeBanner}>
          <Text style={styles.changeBarcodeText} numberOfLines={1}>
            ⊙ Skanna nýtt strikamerki:{" "}
            {changeBarcodeTarget.description || changeBarcodeTarget.item_code}
          </Text>
          <Pressable onPress={cancelChangeBarcode}>
            <Text style={styles.changeBarcodeCancelText}>Hætta við</Text>
          </Pressable>
        </View>
      )}

      {Platform.OS !== "android" && (
        <BarcodeScanner
          visible={iosScanOpen}
          onClose={() => {
            setIosScanOpen(false);
            if (changeBarcodeTarget) cancelChangeBarcode();
          }}
          onScanned={(data) => {
            setIosScanOpen(false);
            handleScanned(data);
          }}
        />
      )}

      {Platform.OS !== "android" && !loading && !allDone && (
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
  container: { flex: 1, backgroundColor: "#F2F0ED" },
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
  backText: { fontSize: 17, color: "#208AEF", fontWeight: "600", paddingVertical: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: {
    color: "#C0392B",
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  finishButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  finishButtonDisabled: { opacity: 0.6 },
  finishButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: "#E2DAD3" },
  finishError: { color: "#C0392B", fontSize: 13, textAlign: "center" },
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
  progressTextDone: { color: "#27AE60" },
  scannerBadge: {
    fontSize: 12,
    color: "#27AE60",
    textAlign: "center",
    marginTop: 2,
  },
  list: { padding: 14, gap: 10 },
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
  fabIcon: { fontSize: 20, color: "#fff" },
  fabLabel: { color: "#fff", fontSize: 17, fontWeight: "700" },
  changeBarcodeBanner: {
    position: "absolute",
    bottom: 54,
    left: 16,
    right: 16,
    borderRadius: 12,
    backgroundColor: "#208AEF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  changeBarcodeText: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  changeBarcodeCancelText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "600",
  },
});
