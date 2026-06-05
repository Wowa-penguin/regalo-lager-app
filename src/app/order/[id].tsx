import { createBarcode } from "@/api/createBarcode";
import { deleteInvoiceNotes } from "@/api/fetchInvoiceNotes";
import { fetchOrder } from "@/api/fetchOrder";
import { fetchProducts } from "@/api/fetchProducts";
import { finishOrder } from "@/api/finishOrder";
import { useZebraScanner } from "@/hooks/useZebraScanner";
import useBarcodeStore from "@/store/useBarcodeStore";
import useStore from "@/store/useStore";
import { Order, OrderLine } from "@/types/order";
import { Product } from "@/types/product";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EMPTY_COUNTS: Record<string, number> = {};
const EMPTY_MISSING: Record<string, number> = {};

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceNumber = Number(id);
  const user = useStore((s) => s.user);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const processingRef = useRef(false);

  const [toastMessage, setToastMessage] = useState("");
  const toastAnim = useRef(new Animated.Value(-80)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [wrongOrderProduct, setWrongOrderProduct] = useState<{
    productId: string;
    barcode: string;
  } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");

  const [manualEntry, setManualEntry] = useState<{
    line: OrderLine;
    count: number;
  } | null>(null);

  const [overpackWarning, setOverpackWarning] = useState<{
    name: string;
    itemCode: string;
    picked: number;
    quantity: number;
    unit: string;
  } | null>(null);

  const pickedCounts = useStore(
    (s) => s.pickedOrders[invoiceNumber] ?? EMPTY_COUNTS,
  );
  const missingCounts = useStore(
    (s) => s.missingOrders[invoiceNumber] ?? EMPTY_MISSING,
  );
  const setItemPicked = useStore((s) => s.setItemPicked);
  const setItemMissing = useStore((s) => s.setItemMissing);

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
    fetchProducts()
      .then(setProducts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      deleteInvoiceNotes(invoiceNumber).catch(() => {});
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [invoiceNumber]);

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

  const pickItem = (line: OrderLine) => {
    const current = pickedCounts[line.item_code] ?? 0;
    const total = itemTotals.get(line.item_code) ?? line.quantity;
    if (current >= total) {
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
    setFinishing(true);
    setFinishError("");
    try {
      await finishOrder(invoiceNumber, user.username);
      setOrder((o) => (o ? { ...o, finished: true } : o));
    } catch (e: unknown) {
      setFinishError(e instanceof Error ? e.message : "Failed to finish order");
    } finally {
      setFinishing(false);
    }
  };

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.product_id, p])),
    [products],
  );

  // Total quantity per item_code across all duplicate lines
  const itemTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of order?.lines ?? []) {
      map.set(line.item_code, (map.get(line.item_code) ?? 0) + line.quantity);
    }
    return map;
  }, [order?.lines]);

  // Distribute the shared pickedCounts counter across duplicate lines in order:
  // Line A fills first, then Line B gets the overflow, etc.
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

  const lines = useMemo(() => {
    const priority = (line: OrderLine) => {
      const picked = attributedPicks.get(line) ?? 0;
      const missing = missingCounts[line.item_code] ?? 0;
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
      const byCategory = (pA?.category ?? "").localeCompare(
        pB?.category ?? "",
        undefined,
        { sensitivity: "base" },
      );
      if (byCategory !== 0) return byCategory;
      const nameA = pA?.name || a.description || a.item_code;
      const nameB = pB?.name || b.description || b.item_code;
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    });
  }, [order?.lines, productMap, attributedPicks, missingCounts]);

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

  const renderLine = ({ item }: { item: OrderLine }) => {
    const picked = attributedPicks.get(item) ?? 0;
    const missing = missingCounts[item.item_code] ?? 0;
    const isComplete = picked >= item.quantity;
    const isPartial = picked > 0 && !isComplete;
    const isMissingAll = missing > 0 && picked === 0;
    const isMissingPartial = missing > 0 && picked > 0 && !isComplete;

    return (
      <View
        style={[
          styles.lineCard,
          isPartial && styles.lineCardPartial,
          isMissingPartial && styles.lineCardMissingPartial,
          isMissingAll && styles.lineCardMissingAll,
          isComplete && styles.lineCardComplete,
        ]}
      >
        <View style={styles.lineLeft}>
          <Pressable
            onPress={() =>
              setManualEntry({
                line: item,
                count: attributedPicks.get(item) ?? 0,
              })
            }
            hitSlop={6}
            style={[
              styles.statusRing,
              isComplete && styles.statusRingComplete,
              isPartial && styles.statusRingPartial,
            ]}
          >
            <Text
              style={[
                styles.statusIcon,
                isComplete && styles.statusIconComplete,
                isPartial && styles.statusIconPartial,
              ]}
            >
              {isComplete ? "✓" : isPartial ? "…" : "+"}
            </Text>
          </Pressable>
          <View style={styles.lineInfo}>
            <Text
              style={[
                styles.description,
                isComplete && styles.descriptionComplete,
              ]}
            >
              {item.description || item.item_code}
            </Text>

            {(() => {
              const qty = productMap.get(item.item_code)?.total_quantity;
              return qty != null ? (
                <Text style={styles.itemCode}>
                  {item.item_code} - magn: {qty}
                </Text>
              ) : (
                <Text style={styles.itemCode}>{item.item_code}</Text>
              );
            })()}
          </View>
        </View>
        <View style={styles.lineRight}>
          <Text
            style={[
              styles.progress,
              isComplete && styles.progressComplete,
              isPartial && styles.progressPartial,
            ]}
          >
            {picked}/{item.quantity} {item.unit}
          </Text>
          {missing > 0 && (
            <View style={styles.missingBadge}>
              <Text style={styles.missingBadgeText}>{missing} vantar</Text>
            </View>
          )}
          <Pressable
            onPress={() =>
              WebBrowser.openBrowserAsync(
                `https://regalo.is/leit?q=${encodeURIComponent(item.item_code)}&page=1&pageIndex=0&pageSize=25`,
              )
            }
            hitSlop={8}
          >
            <Text style={styles.linkIcon}>↗</Text>
          </Pressable>
          <Text style={styles.checkmark}>
            {mappedProductIds.has(item.item_code) ? "✅" : "❌"}
          </Text>
        </View>
      </View>
    );
  };

  const renderAssignItem = ({ item }: { item: OrderLine }) => {
    const product = productMap.get(item.item_code);
    return (
      <Pressable
        style={styles.assignCard}
        onPress={() => handleAssign(item)}
        disabled={assigning}
      >
        <Text style={styles.assignDescription}>
          {product?.name || item.description || item.item_code}
        </Text>
        <Text style={styles.assignItemCode}>
          {item.item_code}
          {product?.category ? ` · ${product.category}` : ""}
        </Text>
      </Pressable>
    );
  };

  const handleBackArrow = async () => {
    const res = await deleteInvoiceNotes(invoiceNumber);
    if (res.status === "deleted") {
      router.back();
    } else {
      // todo: handle Error if status is not deleted
    }
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
            {!allDone && (
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
            renderItem={renderLine}
            contentContainerStyle={styles.list}
          />

          {!!finishError && (
            <View style={styles.footer}>
              <Text style={styles.finishError}>{finishError}</Text>
            </View>
          )}
        </>
      ) : null}

      {/* Scan confirmation toast */}
      <Animated.View
        style={[styles.scanToast, { transform: [{ translateY: toastAnim }] }]}
        pointerEvents="none"
      >
        <Text style={styles.scanToastText} numberOfLines={1}>
          {toastMessage}
        </Text>
      </Animated.View>

      {/* Unknown barcode — assign to product */}
      <Modal
        visible={pendingBarcode !== null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setPendingBarcode(null);
          setAssignError("");
          processingRef.current = false;
        }}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={["bottom"]} style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Óþekkt strikamerki</Text>
            <Text style={styles.modalBarcode}>{pendingBarcode}</Text>
            <Text style={styles.modalSubtitle}>Hvaða vara er þetta?</Text>
            {!!assignError && (
              <Text style={styles.assignError}>{assignError}</Text>
            )}

            <FlatList
              data={assignableLines}
              keyExtractor={(item, index) =>
                item.id != null ? String(item.id) : `${item.item_code}-${index}`
              }
              renderItem={renderAssignItem}
              style={styles.assignList}
              contentContainerStyle={{ gap: 8 }}
              ListEmptyComponent={
                <Text style={styles.assignEmptyText}>
                  Allar vörur hafa þegar verið skannaðar.
                </Text>
              }
            />

            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                setPendingBarcode(null);
                setAssignError("");
                processingRef.current = false;
              }}
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

      {/* Manual entry */}
      <Modal
        visible={manualEntry !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setManualEntry(null)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={["bottom"]} style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {manualEntry?.line.description || manualEntry?.line.item_code}
            </Text>
            <Text style={styles.modalBarcode}>
              {manualEntry?.line.item_code}
            </Text>
            <Text style={styles.modalSubtitle}>
              Required: {manualEntry?.line.quantity} {manualEntry?.line.unit}
            </Text>

            <View style={styles.counterRow}>
              <Pressable
                style={[
                  styles.counterBtn,
                  (manualEntry?.count ?? 0) <= 0 && styles.counterBtnDisabled,
                ]}
                onPress={() =>
                  setManualEntry(
                    (e) => e && { ...e, count: Math.max(0, e.count - 1) },
                  )
                }
                disabled={(manualEntry?.count ?? 0) <= 0}
              >
                <Text style={styles.counterBtnText}>−</Text>
              </Pressable>

              <Text style={styles.counterValue}>{manualEntry?.count ?? 0}</Text>

              <Pressable
                style={[
                  styles.counterBtn,
                  (manualEntry?.count ?? 0) >=
                    (manualEntry?.line.quantity ?? 0) &&
                    styles.counterBtnDisabled,
                ]}
                onPress={() =>
                  setManualEntry(
                    (e) =>
                      e && {
                        ...e,
                        count: Math.min(e.line.quantity, e.count + 1),
                      },
                  )
                }
                disabled={
                  (manualEntry?.count ?? 0) >= (manualEntry?.line.quantity ?? 0)
                }
              >
                <Text style={styles.counterBtnText}>+</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.doneButton}
              onPress={() => {
                if (manualEntry) {
                  setItemPicked(
                    invoiceNumber,
                    manualEntry.line.item_code,
                    manualEntry.count,
                  );
                  if ((missingCounts[manualEntry.line.item_code] ?? 0) > 0) {
                    setItemMissing(
                      invoiceNumber,
                      manualEntry.line.item_code,
                      Math.max(
                        0,
                        manualEntry.line.quantity - manualEntry.count,
                      ),
                    );
                  }
                }
                setManualEntry(null);
              }}
            >
              <Text style={styles.doneButtonText}>Búið</Text>
            </Pressable>

            <Pressable
              style={styles.missingButton}
              onPress={() => {
                if (manualEntry) {
                  const missing = manualEntry.line.quantity - manualEntry.count;
                  setItemPicked(
                    invoiceNumber,
                    manualEntry.line.item_code,
                    manualEntry.count,
                  );
                  setItemMissing(
                    invoiceNumber,
                    manualEntry.line.item_code,
                    missing > 0 ? missing : 0,
                  );
                }
                setManualEntry(null);
              }}
            >
              <Text style={styles.missingButtonText}>Vantar vörur</Text>
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setManualEntry(null)}
            >
              <Text style={styles.cancelText}>Hætta</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Overpack warning */}
      <Modal
        visible={overpackWarning !== null}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setOverpackWarning(null);
          processingRef.current = false;
        }}
      >
        <View style={styles.warnOverlay}>
          <View style={styles.warnSheet}>
            <Text style={styles.warnIcon}>⚠️</Text>
            <Text style={styles.warnTitle}>Nú þegar allt valið</Text>
            {overpackWarning && (
              <>
                <Text style={styles.warnProduct}>{overpackWarning.name}</Text>
                <Text style={styles.warnBody}>
                  Þú hefur þegar skannað{" "}
                  <Text style={styles.warnBold}>
                    {overpackWarning.picked} of {overpackWarning.quantity}{" "}
                    {overpackWarning.unit}
                  </Text>{" "}
                  Fyrir þessa vöru.{"\n"}Ekki bæta meiru við pöntunina.
                </Text>
              </>
            )}
            <Pressable
              style={styles.warnButton}
              onPress={() => {
                setOverpackWarning(null);
                processingRef.current = false;
              }}
            >
              <Text style={styles.warnButtonText}>Áfram</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {/* Wrong order — product known but not in this order */}
      <Modal
        visible={wrongOrderProduct !== null}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setWrongOrderProduct(null);
          processingRef.current = false;
        }}
      >
        <View style={styles.warnOverlay}>
          <View style={styles.warnSheet}>
            <Text style={styles.warnIcon}>⚠️</Text>
            <Text style={styles.warnTitle}>Ekki rétt vara</Text>
            {wrongOrderProduct &&
              (() => {
                const name =
                  products.find(
                    (p) => p.product_id === wrongOrderProduct.productId,
                  )?.name || wrongOrderProduct.productId;
                return (
                  <>
                    <Text style={styles.warnProduct}>{name}</Text>
                    <Text style={styles.warnBody}>
                      Þessi vara er skráð í kerfinu en er{" "}
                      <Text style={styles.warnBold}>
                        ekki hluti af þessari pöntun
                      </Text>
                      .
                    </Text>
                  </>
                );
              })()}
            <Pressable
              style={styles.warnButton}
              onPress={() => {
                setWrongOrderProduct(null);
                processingRef.current = false;
              }}
            >
              <Text style={styles.warnButtonText}>Áfram</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  list: {
    padding: 14,
    gap: 10,
  },
  lineCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 1,
    minHeight: 72,
  },
  lineCardComplete: {
    backgroundColor: "#F0FFF4",
    borderColor: "#C3E6CB",
  },
  lineCardPartial: {
    backgroundColor: "#EBF5FF",
    borderColor: "#BEE3F8",
  },
  lineCardMissingPartial: {
    backgroundColor: "#FFFDE7",
    borderColor: "#FFE082",
  },
  lineCardMissingAll: {
    backgroundColor: "#FFF0F0",
    borderColor: "#F5C6CB",
  },
  lineLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  statusRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#D0D0D0",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statusRingComplete: {
    backgroundColor: "#27AE60",
    borderColor: "#27AE60",
  },
  statusRingPartial: {
    borderColor: "#208AEF",
  },
  statusIcon: {
    fontSize: 15,
    color: "#C0C0C0",
  },
  statusIconComplete: {
    color: "#fff",
    fontWeight: "700",
  },
  statusIconPartial: {
    color: "#208AEF",
    fontWeight: "700",
  },
  lineInfo: {
    flex: 1,
    gap: 3,
  },
  description: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    lineHeight: 22,
  },
  descriptionComplete: {
    color: "#27AE60",
  },
  itemCode: {
    fontSize: 12,
    color: "#aaa",
  },
  lineRight: {
    alignItems: "flex-end",
    gap: 6,
    marginLeft: 8,
  },
  progress: {
    fontSize: 15,
    fontWeight: "700",
    color: "#C0C0C0",
    flexShrink: 0,
  },
  progressComplete: {
    color: "#27AE60",
  },
  progressPartial: {
    color: "#208AEF",
  },
  linkIcon: {
    fontSize: 16,
    color: "#208AEF",
    fontWeight: "600",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  warnOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  modalBarcode: {
    fontSize: 14,
    color: "#888",
    fontFamily: "monospace",
    marginBottom: 16,
  },
  modalSubtitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
    marginBottom: 12,
  },
  assignList: {
    flexGrow: 0,
  },
  assignEmptyText: {
    fontSize: 15,
    color: "#aaa",
    textAlign: "center",
    paddingVertical: 20,
  },
  assignError: {
    color: "#C0392B",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 6,
  },
  assignCard: {
    backgroundColor: "#F7F5F2",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2DAD3",
  },
  assignDescription: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  assignItemCode: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 3,
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
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    paddingVertical: 12,
  },
  counterBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#208AEF",
    alignItems: "center",
    justifyContent: "center",
  },
  counterBtnDisabled: {
    backgroundColor: "#D0D0D0",
  },
  counterBtnText: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "600",
    lineHeight: 34,
  },
  counterValue: {
    fontSize: 52,
    fontWeight: "700",
    color: "#1a1a1a",
    minWidth: 72,
    textAlign: "center",
  },
  doneButton: {
    backgroundColor: "#208AEF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
    marginTop: 4,
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  missingButton: {
    borderWidth: 1.5,
    borderColor: "#C0392B",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    width: "100%",
  },
  missingButtonText: {
    color: "#C0392B",
    fontSize: 16,
    fontWeight: "600",
  },
  missingBadge: {
    backgroundColor: "#FDECEA",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: "flex-end",
  },
  missingBadgeText: {
    color: "#C0392B",
    fontSize: 12,
    fontWeight: "600",
  },
  warnSheet: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  warnIcon: {
    fontSize: 44,
  },
  warnTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
  },
  warnProduct: {
    fontSize: 16,
    fontWeight: "600",
    color: "#555",
    textAlign: "center",
  },
  warnBody: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  warnBold: {
    fontWeight: "700",
    color: "#C0392B",
  },
  warnButton: {
    marginTop: 8,
    backgroundColor: "#C0392B",
    borderRadius: 12,
    paddingHorizontal: 36,
    paddingVertical: 15,
    width: "100%",
    alignItems: "center",
  },
  warnButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
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
  checkmark: {
    fontSize: 10,
  },
});
