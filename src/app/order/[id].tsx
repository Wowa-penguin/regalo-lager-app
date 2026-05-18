import { fetchOrder } from "@/api/fetchOrder";
import { createBarcode } from "@/api/createBarcode";
import BarcodeScanner from "@/components/BarcodeScanner";
import useBarcodeStore from "@/store/useBarcodeStore";
import { Order, OrderLine } from "@/types/order";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
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

type PickedCounts = Record<string, number>;

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pickedCounts, setPickedCounts] = useState<PickedCounts>({});
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanFeedback, setScanFeedback] = useState("");

  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const findProductId = useBarcodeStore((s) => s.findProductId);
  const addBarcode = useBarcodeStore((s) => s.addBarcode);

  useEffect(() => {
    fetchOrder(Number(id))
      .then(setOrder)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load order")
      )
      .finally(() => setLoading(false));
  }, [id]);

  const pickItem = (line: OrderLine) => {
    const needed = Number(line.quantity);
    const current = pickedCounts[line.item_code] ?? 0;
    if (current >= needed) {
      setScanFeedback(`✓ ${line.item_code} already complete`);
      return;
    }
    const next = current + 1;
    setPickedCounts((prev) => ({ ...prev, [line.item_code]: next }));
    setScanFeedback(`✓ ${line.item_code}   ${next} / ${line.quantity} ${line.unit}`);
  };

  const handleScanned = (data: string) => {
    if (!order?.lines) return;

    // Resolve barcode → product_id (mapped or raw barcode as fallback)
    const productId = findProductId(data) ?? data;
    const line = order.lines.find((l) => l.item_code === productId);

    if (!line) {
      // Unknown — close scanner and ask user to assign
      setScannerVisible(false);
      setPendingBarcode(data);
      return;
    }

    pickItem(line);
  };

  const handleAssign = async (line: OrderLine) => {
    if (!pendingBarcode) return;
    setAssigning(true);
    try {
      const mapping = await createBarcode(pendingBarcode, line.item_code);
      addBarcode(mapping);
      pickItem(line);
    } catch {
      // silently ignore — user can try again
    } finally {
      setPendingBarcode(null);
      setAssigning(false);
    }
  };

  const lines = order?.lines ?? [];
  const completedLines = lines.filter((l) => {
    const picked = pickedCounts[l.item_code] ?? 0;
    return picked >= Number(l.quantity);
  }).length;
  const allDone = lines.length > 0 && completedLines === lines.length;

  const renderLine = ({ item }: { item: OrderLine }) => {
    const needed = Number(item.quantity);
    const picked = pickedCounts[item.item_code] ?? 0;
    const isComplete = picked >= needed;
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
          <View
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
              {isComplete ? "✓" : isPartial ? "…" : "○"}
            </Text>
          </View>
          <View style={styles.lineInfo}>
            <Text
              style={[styles.description, isComplete && styles.descriptionComplete]}
              numberOfLines={1}
            >
              {item.description || item.item_code}
            </Text>
            <Text style={styles.itemCode}>{item.item_code}</Text>
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
          <Pressable
            onPress={() =>
              WebBrowser.openBrowserAsync(
                `https://regalo.is/leit?q=${encodeURIComponent(item.item_code)}&page=1&pageIndex=0&pageSize=25`
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

  const renderAssignItem = ({ item }: { item: OrderLine }) => (
    <Pressable
      style={styles.assignCard}
      onPress={() => handleAssign(item)}
      disabled={assigning}
    >
      <Text style={styles.assignDescription}>{item.description || item.item_code}</Text>
      <Text style={styles.assignItemCode}>{item.item_code}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {order?.customer_name ?? `Order #${id}`}
        </Text>
        <Pressable style={styles.scanButton} onPress={() => setScannerVisible(true)}>
          <Text style={styles.scanButtonText}>Scan</Text>
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
          <View style={[styles.progressBanner, allDone && styles.progressBannerDone]}>
            <Text style={[styles.progressText, allDone && styles.progressTextDone]}>
              {allDone
                ? "✓ All items picked!"
                : `${completedLines} of ${lines.length} items complete`}
            </Text>
          </View>

          <FlatList
            data={lines}
            keyExtractor={(item, index) =>
              item.id != null ? String(item.id) : `${item.item_code}-${index}`
            }
            renderItem={renderLine}
            contentContainerStyle={styles.list}
          />
        </>
      ) : null}

      {/* Barcode scanner */}
      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleScanned}
        feedback={scanFeedback}
      />

      {/* Unknown barcode — assign to product */}
      <Modal
        visible={pendingBarcode !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPendingBarcode(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Unknown barcode</Text>
            <Text style={styles.modalBarcode}>{pendingBarcode}</Text>
            <Text style={styles.modalSubtitle}>Which product does this represent?</Text>

            <FlatList
              data={lines}
              keyExtractor={(item, index) =>
                item.id != null ? String(item.id) : `${item.item_code}-${index}`
              }
              renderItem={renderAssignItem}
              style={styles.assignList}
              contentContainerStyle={{ gap: 8 }}
            />

            <Pressable
              style={styles.cancelButton}
              onPress={() => setPendingBarcode(null)}
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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
});
