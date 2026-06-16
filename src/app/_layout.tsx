import { fetchBarcodes } from "@/api/fetchBarcodes";
import { fetchSortConfig } from "@/api/fetchSortConfig";
import useStore, { loadSession } from "@/store/useStore";
import useBarcodeStore from "@/store/useBarcodeStore";
import useCustomSortStore from "@/store/useCustomSortStore";
import { setAuthToken } from "@/utils/auth";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const setUser = useStore((s) => s.setUser);
  const setBarcodes = useBarcodeStore((s) => s.setBarcodes);
  const loadPersistedSort = useCustomSortStore((s) => s.loadPersistedSort);
  const setAllCategoryOrder = useCustomSortStore((s) => s.setAllCategoryOrder);

  useEffect(() => {
    loadSession().then(async (session) => {
      // Await SecureStore so sort data is ready before the UI renders
      await loadPersistedSort().catch(() => {});
      if (session) {
        setUser(session.user);
        setAuthToken(session.token);
        fetchBarcodes().then(setBarcodes).catch(() => {});
        // Server fetch overwrites local cache in background
        fetchSortConfig().then(setAllCategoryOrder).catch(() => {});
      }
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "#F7F5F2", alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
