import { createBarcode } from "@/api/createBarcode";
import { fetchOrder } from "@/api/fetchOrder";
import { fetchProducts } from "@/api/fetchProducts";
import { finishOrder } from "@/api/finishOrder";
import BarcodeScanner from "@/components/BarcodeScanner";
import useBarcodeStore from "@/store/useBarcodeStore";
import useStore from "@/store/useStore";
import { Order, OrderLine } from "@/types/order";
import { Product } from "@/types/product";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [scannerVisible, setScannerVisible] = useState(false);
  const processingRef = useRef(false);

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

  const pickItem = (line: OrderLine) => {
    const current = pickedCounts[line.item_code] ?? 0;
    if (current >= line.quantity) {
      setOverpackWarning({
        name: line.description || line.item_code,
        itemCode: line.item_code,
        picked: current,
        quantity: line.quantity,
        unit: line.unit,
      });
      return;
    }
    const next = current + 1;
    setItemPicked(invoiceNumber, line.item_code, next);
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
      setScannerVisible(false);
      if (knownProductId !== null) {
        setWrongOrderProduct({ productId: knownProductId, barcode: data });
      } else {
        setPendingBarcode(data);
      }
      return;
    }

    setScannerVisible(false);
    pickItem(line);
  };

  const handleAssign = async (line: OrderLine) => {
    if (!pendingBarcode) return;
    setAssigning(true);
    setAssignError("");
    try {
      const mapping = await createBarcode(pendingBarcode, line.item_code);
      addBarcode(mapping);
      pickItem(line);
      setPendingBarcode(null);
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
      await finishOrder(invoiceNumber);
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

  const lines = useMemo(() => {
    return [...(order?.lines ?? [])].sort((a, b) => {
      const doneA = (pickedCounts[a.item_code] ?? 0) >= a.quantity ? 1 : 0;
      const doneB = (pickedCounts[b.item_code] ?? 0) >= b.quantity ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
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
  }, [order?.lines, productMap, pickedCounts]);

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
    (l) => (pickedCounts[l.item_code] ?? 0) >= l.quantity,
  ).length;
  const allDone = lines.length > 0 && completedLines === lines.length;

  const renderLine = ({ item }: { item: OrderLine }) => {
    const picked = pickedCounts[item.item_code] ?? 0;
    const isComplete = picked >= item.quantity;
    const isPartial = picked > 0 && !isComplete;

    return (
      <View
        style={[
          styles.lineCard,
          isComplete && styles.lineCardComplete,
          isPartial && styles.lineCardPartial,
        ]}
      >
        <View style={styles.lineLeft}>
          <Pressable
            onPress={() =>
              setManualEntry({
                line: item,
                count: pickedCounts[item.item_code] ?? 0,
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
                  {item.item_code} - Stock: {qty}
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
          {(missingCounts[item.item_code] ?? 0) > 0 && (
            <View style={styles.missingBadge}>
              <Text style={styles.missingBadgeText}>
                {missingCounts[item.item_code]} missing
              </Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {order?.customer_name ?? `Order #${id}`}
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
              {order?.finished ? "Finished" : "Finish"}
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
                ? "✓ All items picked!"
                : `${completedLines} of ${lines.length} items complete`}
            </Text>
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

          <View style={styles.footer}>
            {!!finishError && (
              <Text style={styles.finishError}>{finishError}</Text>
            )}
            <Pressable
              style={styles.scanButton}
              onPress={() => {
                processingRef.current = false;
                setScannerVisible(true);
              }}
            >
              <Text style={styles.scanButtonText}>Scan</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {/* Barcode scanner */}
      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleScanned}
      />

      {/* Unknown barcode — assign to product */}
      <Modal
        visible={pendingBarcode !== null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setPendingBarcode(null);
          setAssignError("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Unknown barcode</Text>
            <Text style={styles.modalBarcode}>{pendingBarcode}</Text>
            <Text style={styles.modalSubtitle}>
              Which product does this represent?
            </Text>
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
                  All products have already been scanned.
                </Text>
              }
            />

            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                setPendingBarcode(null);
                setAssignError("");
              }}
              disabled={assigning}
            >
              {assigning ? (
                <ActivityIndicator color="#888" />
              ) : (
                <Text style={styles.cancelText}>Cancel</Text>
              )}
            </Pressable>
          </View>
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
          <View style={styles.modalSheet}>
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
                }
                setManualEntry(null);
              }}
            >
              <Text style={styles.doneButtonText}>Done</Text>
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
              <Text style={styles.missingButtonText}>Rest does not exist</Text>
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setManualEntry(null)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Overpack warning */}
      <Modal
        visible={overpackWarning !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setOverpackWarning(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.warnSheet}>
            <Text style={styles.warnIcon}>⚠️</Text>
            <Text style={styles.warnTitle}>Already fully picked</Text>
            {overpackWarning && (
              <>
                <Text style={styles.warnProduct}>{overpackWarning.name}</Text>
                <Text style={styles.warnBody}>
                  You've already scanned{" "}
                  <Text style={styles.warnBold}>
                    {overpackWarning.picked} of {overpackWarning.quantity}{" "}
                    {overpackWarning.unit}
                  </Text>{" "}
                  for this item.{"\n"}Don't add more to the order.
                </Text>
              </>
            )}
            <Pressable
              style={styles.warnButton}
              onPress={() => setOverpackWarning(null)}
            >
              <Text style={styles.warnButtonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {/* Wrong order — product known but not in this order */}
      <Modal
        visible={wrongOrderProduct !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setWrongOrderProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.warnSheet}>
            <Text style={styles.warnIcon}>⚠️</Text>
            <Text style={styles.warnTitle}>Wrong order</Text>
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
                      This product is registered in the system but is{" "}
                      <Text style={styles.warnBold}>
                        not part of this order
                      </Text>
                      .
                    </Text>
                  </>
                );
              })()}
            <Pressable
              style={styles.warnButton}
              onPress={() => setWrongOrderProduct(null)}
            >
              <Text style={styles.warnButtonText}>Got it</Text>
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
    gap: 12,
  },
  backText: {
    fontSize: 16,
    color: "#208AEF",
    fontWeight: "500",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
  },
  scanButton: {
    backgroundColor: "#208AEF",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
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
    gap: 8,
  },
  finishButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 14,
    paddingVertical: 7,
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
    fontSize: 14,
    fontWeight: "600",
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
    fontSize: 14,
    fontWeight: "600",
    color: "#208AEF",
    textAlign: "center",
  },
  progressTextDone: {
    color: "#27AE60",
  },
  list: {
    padding: 16,
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
  },
  lineCardComplete: {
    backgroundColor: "#F0FFF4",
    borderColor: "#C3E6CB",
  },
  lineCardPartial: {
    backgroundColor: "#EBF5FF",
    borderColor: "#BEE3F8",
  },
  lineLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  statusRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
    fontSize: 13,
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
    gap: 2,
  },
  description: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  descriptionComplete: {
    color: "#27AE60",
  },
  itemCode: {
    fontSize: 11,
    color: "#aaa",
    marginTop: 1,
  },
  lineRight: {
    alignItems: "flex-end",
    gap: 6,
    marginLeft: 8,
  },
  progress: {
    fontSize: 14,
    fontWeight: "600",
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
    fontSize: 14,
    color: "#208AEF",
    fontWeight: "600",
  },

  // Assign modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: "75%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  modalBarcode: {
    fontSize: 13,
    color: "#888",
    fontFamily: "monospace",
    marginBottom: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    marginBottom: 12,
  },
  assignList: {
    flexGrow: 0,
  },
  assignEmptyText: {
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
    paddingVertical: 16,
  },
  assignError: {
    color: "#C0392B",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 4,
  },
  assignCard: {
    backgroundColor: "#F7F5F2",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2DAD3",
  },
  assignDescription: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  assignItemCode: {
    fontSize: 11,
    color: "#aaa",
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2DAD3",
  },
  cancelText: {
    fontSize: 15,
    color: "#888",
    fontWeight: "500",
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    paddingVertical: 8,
  },
  counterBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#208AEF",
    alignItems: "center",
    justifyContent: "center",
  },
  counterBtnDisabled: {
    backgroundColor: "#D0D0D0",
  },
  counterBtnText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "600",
    lineHeight: 30,
  },
  counterValue: {
    fontSize: 48,
    fontWeight: "700",
    color: "#1a1a1a",
    minWidth: 64,
    textAlign: "center",
  },
  doneButton: {
    backgroundColor: "#208AEF",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
    marginTop: 4,
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  missingButton: {
    borderWidth: 1.5,
    borderColor: "#C0392B",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    width: "100%",
  },
  missingButtonText: {
    color: "#C0392B",
    fontSize: 15,
    fontWeight: "600",
  },
  missingBadge: {
    backgroundColor: "#FDECEA",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-end",
  },
  missingBadgeText: {
    color: "#C0392B",
    fontSize: 11,
    fontWeight: "600",
  },
  warnSheet: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    marginHorizontal: 32,
    alignItems: "center",
    gap: 10,
  },
  warnIcon: {
    fontSize: 40,
  },
  warnTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
  },
  warnProduct: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
    textAlign: "center",
  },
  warnBody: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 21,
  },
  warnBold: {
    fontWeight: "700",
    color: "#C0392B",
  },
  warnButton: {
    marginTop: 8,
    backgroundColor: "#C0392B",
    borderRadius: 10,
    paddingHorizontal: 36,
    paddingVertical: 13,
    width: "100%",
    alignItems: "center",
  },
  warnButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  toast: {
    position: "absolute",
    bottom: 90,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  noteBanner: {
    backgroundColor: "#FFFBE6",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#FFE58F",
  },
  noteText: {
    fontSize: 13,
    color: "#7C5800",
    fontWeight: "500",
  },
});
