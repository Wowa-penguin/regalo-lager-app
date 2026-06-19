import { getCategoryName } from "@/constants/const";
import { OrderLine } from "@/types/order";
import { Product } from "@/types/product";
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

interface Props {
  pendingBarcode: string | null;
  assigning: boolean;
  assignError: string;
  assignableLines: OrderLine[];
  productMap: Map<string, Product>;
  onClose: () => void;
  onAssign: (line: OrderLine) => void;
}

export default function AssignBarcodeModal({
  pendingBarcode,
  assigning,
  assignError,
  assignableLines,
  productMap,
  onClose,
  onAssign,
}: Props) {
  return (
    <Modal
      visible={pendingBarcode !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <Text style={styles.title}>Óþekkt strikamerki</Text>
          <Text style={styles.barcode}>{pendingBarcode}</Text>
          <Text style={styles.subtitle}>Hvaða vara er þetta?</Text>

          {!!assignError && (
            <Text style={styles.error}>{assignError}</Text>
          )}

          <FlatList
            data={assignableLines}
            keyExtractor={(item, index) =>
              item.id != null ? String(item.id) : `${item.item_code}-${index}`
            }
            renderItem={({ item }) => {
              const product = productMap.get(item.item_code);
              return (
                <Pressable
                  style={styles.assignCard}
                  onPress={() => onAssign(item)}
                  disabled={assigning}
                >
                  <Text style={styles.assignName}>
                    {product?.name || item.description || item.item_code}
                  </Text>
                  <Text style={styles.assignCode}>
                    {item.item_code}
                    {product?.category ? ` · ${getCategoryName(product.category)}` : ""}
                  </Text>
                </Pressable>
              );
            }}
            style={styles.list}
            contentContainerStyle={{ gap: 8 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                Allar vörur hafa þegar verið skannaðar.
              </Text>
            }
          />

          <Pressable style={styles.cancelButton} onPress={onClose} disabled={assigning}>
            {assigning ? (
              <ActivityIndicator color="#888" />
            ) : (
              <Text style={styles.cancelText}>Hætta</Text>
            )}
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  barcode: {
    fontSize: 14,
    color: "#888",
    fontFamily: "monospace",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
    marginBottom: 12,
  },
  error: {
    color: "#C0392B",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 6,
  },
  list: {
    flexGrow: 0,
  },
  emptyText: {
    fontSize: 15,
    color: "#aaa",
    textAlign: "center",
    paddingVertical: 20,
  },
  assignCard: {
    backgroundColor: "#F7F5F2",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2DAD3",
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
});
