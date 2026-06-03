import { useEffect, useRef, useState } from "react";
import {
  Animated,
  DeviceEventEmitter,
  Easing,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const DEBOUNCE_MS = 700;

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
  feedback?: string;
}

export default function BarcodeScanner({
  visible,
  onClose,
  onScanned,
  feedback,
}: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);
  const hasScannedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!visible) {
      lastScanRef.current = null;
      hasScannedRef.current = false;
      setReady(false);
      return;
    }

    lastScanRef.current = null;
    hasScannedRef.current = false;
    setReady(false);

    if (Platform.OS !== "android" || !NativeModules.ZebraScan) {
      setReady(true);
      return;
    }

    NativeModules.ZebraScan.startListening();
    // Small delay so DataWedge profile is applied before we show "ready"
    const t = setTimeout(() => setReady(true), 400);

    const sub = DeviceEventEmitter.addListener("ZebraScan", (barcode: string) => {
      if (hasScannedRef.current) return;
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.code === barcode && now - last.time < DEBOUNCE_MS) return;
      lastScanRef.current = { code: barcode, time: now };
      hasScannedRef.current = true;
      onScanned(barcode);
    });

    return () => {
      clearTimeout(t);
      sub.remove();
      NativeModules.ZebraScan.stopListening();
    };
  }, [visible]);

  // Pulse animation for the scan beam icon
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>✕ Close</Text>
        </Pressable>

        <View style={styles.body}>
          <Animated.View
            style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}
          >
            <Text style={styles.icon}>▬▬▬{"\n"}▬▬▬▬▬{"\n"}▬▬▬</Text>
          </Animated.View>

          <Text style={styles.title}>
            {ready ? "Scanner ready" : "Starting scanner…"}
          </Text>
          <Text style={styles.hint}>
            {ready
              ? "Press the orange trigger button to scan"
              : "Configuring DataWedge…"}
          </Text>

          {!!feedback && (
            <View style={styles.feedbackBox}>
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D1117",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 56,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  closeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  body: {
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 40,
  },
  iconWrap: {
    backgroundColor: "rgba(32,138,239,0.15)",
    borderRadius: 32,
    padding: 32,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "rgba(32,138,239,0.4)",
  },
  icon: {
    color: "#208AEF",
    fontSize: 22,
    lineHeight: 30,
    textAlign: "center",
    letterSpacing: 3,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  hint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  feedbackBox: {
    marginTop: 8,
    backgroundColor: "rgba(32,138,239,0.2)",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(32,138,239,0.4)",
  },
  feedbackText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
});
