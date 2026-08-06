import { LorealInvoice } from "@/types/invoices";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Props {
  entry: { item: LorealInvoice; initialCount: number } | null;
  onClose: () => void;
  onDone: (count: number) => void;
}

export default function LorealCollectModal({ entry, onClose, onDone }: Props) {
  const [raw, setRaw] = useState("0");

  useEffect(() => {
    if (entry) setRaw(String(entry.initialCount));
  }, [entry?.item.id]);

  const item = entry?.item;
  const count = parseFloat(raw) || 0;
  const atMax = count >= (item?.qty ?? 0);
  const atMin = count <= 0;

  const handleText = (t: string) => {
    // Allow digits and one decimal point only
    const cleaned = t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    setRaw(cleaned);
  };

  const step = (delta: number) => {
    const next = Math.max(0, parseFloat(raw || "0") + delta);
    setRaw(String(next));
  };

  return (
    <Modal
      visible={entry !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <Text style={styles.title} numberOfLines={2}>
            {item?.description}
          </Text>
          <Text style={styles.meta}>
            {[item?.brand, item?.article_no].filter(Boolean).join(" · ")}
          </Text>
          <Text style={styles.subtitle}>Magn: {item?.qty}</Text>

          <View style={styles.counterRow}>
            <Pressable
              style={[styles.counterBtn, atMin && styles.counterBtnDisabled]}
              onPress={() => step(-1)}
              disabled={atMin}
            >
              <Text style={styles.counterBtnText}>−</Text>
            </Pressable>

            <TextInput
              style={styles.counterValue}
              value={raw}
              onChangeText={handleText}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />

            <Pressable
              style={[styles.counterBtn, atMax && styles.counterBtnDisabled]}
              onPress={() => step(1)}
              disabled={atMax}
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
  meta: {
    fontSize: 13,
    color: "#888",
    fontFamily: "monospace",
    marginBottom: 4,
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
    minWidth: 96,
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
