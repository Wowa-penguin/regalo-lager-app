import { Lyko } from "@/types/invoices";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Props {
  entry: { item: Lyko; initialCount: number } | null;
  onClose: () => void;
  onDone: (count: number) => void;
}

export default function CollectQuantityModal({ entry, onClose, onDone }: Props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (entry) setCount(entry.initialCount);
  }, [entry?.item.id]);

  const item = entry?.item;

  return (
    <Modal
      visible={entry !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <Text style={styles.title}>{item?.name}</Text>
          <Text style={styles.code}>{item?.product_id}</Text>
          <Text style={styles.subtitle}>Magn: {item?.quantity}</Text>

          <View style={styles.counterRow}>
            <Pressable
              style={[styles.counterBtn, count <= 0 && styles.counterBtnDisabled]}
              onPress={() => setCount((c) => Math.max(0, c - 1))}
              disabled={count <= 0}
            >
              <Text style={styles.counterBtnText}>−</Text>
            </Pressable>

            <Text style={styles.counterValue}>{count}</Text>

            <Pressable
              style={[
                styles.counterBtn,
                count >= (item?.quantity ?? 0) && styles.counterBtnDisabled,
              ]}
              onPress={() =>
                setCount((c) => Math.min(item?.quantity ?? 0, c + 1))
              }
              disabled={count >= (item?.quantity ?? 0)}
            >
              <Text style={styles.counterBtnText}>+</Text>
            </Pressable>
          </View>

          <Pressable style={styles.doneButton} onPress={() => onDone(count)}>
            <Text style={styles.doneButtonText}>Búið</Text>
          </Pressable>

          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Hætta</Text>
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
  code: {
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
