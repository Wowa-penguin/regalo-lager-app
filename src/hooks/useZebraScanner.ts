import { useEffect, useRef } from "react";
import { DeviceEventEmitter, NativeModules, Platform } from "react-native";

const DEBOUNCE_MS = 600;

export function useZebraScanner(
  active: boolean,
  onScanned: (data: string) => void,
) {
  const callbackRef = useRef(onScanned);
  callbackRef.current = onScanned;
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);

  useEffect(() => {
    if (!active || Platform.OS !== "android" || !NativeModules.ZebraScan) return;

    NativeModules.ZebraScan.startListening();

    const sub = DeviceEventEmitter.addListener("ZebraScan", (barcode: string) => {
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.code === barcode && now - last.time < DEBOUNCE_MS) return;
      lastScanRef.current = { code: barcode, time: now };
      callbackRef.current(barcode);
    });

    return () => {
      sub.remove();
      NativeModules.ZebraScan.stopListening();
    };
  }, [active]);
}
