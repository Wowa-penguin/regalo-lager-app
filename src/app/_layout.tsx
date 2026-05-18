import { fetchBarcodes } from "@/api/fetchBarcodes";
import useStore, { loadSession } from "@/store/useStore";
import useBarcodeStore from "@/store/useBarcodeStore";
import { setAuthToken } from "@/utils/auth";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const setUser = useStore((s) => s.setUser);
  const setBarcodes = useBarcodeStore((s) => s.setBarcodes);

  useEffect(() => {
    loadSession().then(async (session) => {
      if (session) {
        setUser(session.user);
        setAuthToken(session.token);
        fetchBarcodes().then(setBarcodes).catch(() => {});
      }
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F7F5F2", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
