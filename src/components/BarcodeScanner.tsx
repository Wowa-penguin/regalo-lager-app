import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef } from "react";
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCAN_SIZE = SCREEN_WIDTH * 0.7;
const DEBOUNCE_MS = 700;

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
  feedback?: string;
}

export default function BarcodeScanner({ visible, onClose, onScanned, feedback }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const scanLineY = useRef(new Animated.Value(0)).current;
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);

  useEffect(() => {
    if (!visible) {
      scanLineY.setValue(0);
      lastScanRef.current = null;
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, {
          toValue: SCAN_SIZE - 2,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineY, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  const handleBarcode = ({ data }: { data: string }) => {
    const now = Date.now();
    const last = lastScanRef.current;
    if (last && last.code === data && now - last.time < DEBOUNCE_MS) return;
    lastScanRef.current = { code: data, time: now };
    onScanned(data);
  };

  const renderContent = () => {
    if (!permission) return <View style={styles.flex} />;

    if (!permission.granted) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.message}>Camera permission is required to scan barcodes.</Text>
          <Pressable style={styles.grantButton} onPress={requestPermission}>
            <Text style={styles.grantButtonText}>Grant Permission</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          autofocus="on"
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "code128", "code39", "qr"],
          }}
          onBarcodeScanned={handleBarcode}
        />

        <View style={styles.overlayTop} />

        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanWindow}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <Animated.View
              style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]}
            />
          </View>
          <View style={styles.overlaySide} />
        </View>

        <View style={styles.overlayBottom}>
          {feedback ? (
            <Text style={styles.feedback}>{feedback}</Text>
          ) : (
            <Text style={styles.hint}>Align barcode within the frame</Text>
          )}
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {renderContent()}
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>✕ Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const OVERLAY_COLOR = "rgba(0,0,0,0.6)";
const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = "#fff";

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  message: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  grantButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  grantButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  overlayTop: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  overlayMiddle: {
    flexDirection: "row",
    height: SCAN_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  hint: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
  },
  feedback: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  scanWindow: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    overflow: "hidden",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#208AEF",
    shadowColor: "#208AEF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
  },
  closeButton: {
    position: "absolute",
    top: 56,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  closeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
