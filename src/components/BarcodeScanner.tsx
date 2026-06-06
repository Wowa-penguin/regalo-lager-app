import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
const USE_ZEBRA =
  Platform.OS === "android" && !!NativeModules.ZebraScan;

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
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    if (!visible) {
      lastScanRef.current = null;
      hasScannedRef.current = false;
      setReady(false);
      setTorchOn(false);
      setZoom(0);
      return;
    }

    lastScanRef.current = null;
    hasScannedRef.current = false;

    if (!USE_ZEBRA) {
      setReady(true);
      return;
    }

    NativeModules.ZebraScan.startListening();
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

  // Pulse animation — Zebra UI only
  useEffect(() => {
    if (!visible || !USE_ZEBRA) return;
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

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (hasScannedRef.current) return;
    const now = Date.now();
    const last = lastScanRef.current;
    if (last && last.code === data && now - last.time < DEBOUNCE_MS) return;
    lastScanRef.current = { code: data, time: now };
    hasScannedRef.current = true;
    onScanned(data);
  };

  const stepZoom = (delta: number) => {
    setZoom((z) => Math.round(Math.min(0.8, Math.max(0, z + delta)) * 10) / 10);
  };

  // zoom 0.0–0.8 in 0.1 steps → displayed as 1×–9×
  const zoomLabel = `${Math.round(zoom * 10) + 1}×`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>✕ Loka</Text>
        </Pressable>

        {USE_ZEBRA ? (
          /* ── Zebra hardware scanner UI ── */
          <View style={styles.body}>
            <Animated.View
              style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}
            >
              <Text style={styles.icon}>▬▬▬{"\n"}▬▬▬▬▬{"\n"}▬▬▬</Text>
            </Animated.View>
            <Text style={styles.title}>
              {ready ? "Skanni tilbúinn" : "Ræsi skanna…"}
            </Text>
            <Text style={styles.hint}>
              {ready
                ? "Ýttu á appelsínugula hnappinn til að skanna"
                : "Stillir DataWedge…"}
            </Text>
          </View>
        ) : !permission ? (
          <View style={styles.body}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.body}>
            <Text style={styles.title}>Myndavél þarf aðgang</Text>
            <Text style={styles.hint}>
              Leyfðu aðgang að myndavél til að skanna strikamerki.
            </Text>
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Leyfa myndavél</Text>
            </Pressable>
          </View>
        ) : (
          /* ── Camera scanner UI ── */
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchOn}
              zoom={zoom}
              onBarcodeScanned={handleBarcodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: [
                  "ean13",
                  "ean8",
                  "code128",
                  "code39",
                  "qr",
                  "upc_a",
                  "upc_e",
                  "itf14",
                ],
              }}
            />

            {/* Viewfinder overlay */}
            <View style={styles.viewfinderOverlay} pointerEvents="none">
              <View style={styles.viewfinderFrame} />
              <Text style={styles.viewfinderHint}>Punkaðu strikamerkið</Text>
            </View>

            {/* Camera controls */}
            <View style={styles.cameraControls}>
              {/* Flashlight toggle */}
              <Pressable
                style={[styles.controlBtn, torchOn && styles.controlBtnActive]}
                onPress={() => setTorchOn((t) => !t)}
              >
                <Text style={styles.controlBtnIcon}>
                  {torchOn ? "🔦" : "☽"}
                </Text>
                <Text style={styles.controlBtnLabel}>
                  {torchOn ? "Slökkva" : "Ljós"}
                </Text>
              </Pressable>

              {/* Zoom */}
              <View style={styles.zoomRow}>
                <Pressable
                  style={[styles.zoomBtn, zoom <= 0 && styles.zoomBtnDisabled]}
                  onPress={() => stepZoom(-0.1)}
                  disabled={zoom <= 0}
                >
                  <Text style={styles.zoomBtnText}>−</Text>
                </Pressable>
                <Text style={styles.zoomLabel}>{zoomLabel}</Text>
                <Pressable
                  style={[styles.zoomBtn, zoom >= 0.8 && styles.zoomBtnDisabled]}
                  onPress={() => stepZoom(0.1)}
                  disabled={zoom >= 0.8}
                >
                  <Text style={styles.zoomBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {!!feedback && (
          <View style={styles.feedbackBox}>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        )}
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
    zIndex: 10,
  },
  closeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  // Zebra UI
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

  // Camera viewfinder
  viewfinderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  viewfinderFrame: {
    width: 260,
    height: 160,
    borderWidth: 2,
    borderColor: "#208AEF",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  viewfinderHint: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: "hidden",
  },

  // Camera controls bar
  cameraControls: {
    position: "absolute",
    bottom: 60,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  controlBtn: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    minWidth: 72,
  },
  controlBtnActive: {
    borderColor: "#208AEF",
    backgroundColor: "rgba(32,138,239,0.2)",
  },
  controlBtnIcon: {
    fontSize: 22,
  },
  controlBtnLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  zoomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  zoomBtnDisabled: {
    opacity: 0.35,
  },
  zoomBtnText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 26,
  },
  zoomLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    minWidth: 36,
    textAlign: "center",
  },

  // Permission
  permissionButton: {
    backgroundColor: "#208AEF",
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  feedbackBox: {
    position: "absolute",
    bottom: 160,
    left: 20,
    right: 20,
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
