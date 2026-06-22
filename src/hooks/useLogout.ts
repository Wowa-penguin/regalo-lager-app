import { fetchLogout } from "@/api/fetchLogout";
import useStore, { clearSession } from "@/store/useStore";
import { setAuthToken } from "@/utils/auth";
import { Alert } from "react-native";

export function useLogout() {
  const logout = useStore((s) => s.logout);

  return async () => {
    try {
      const res = await fetchLogout();
      if (res.status !== "success") {
        Alert.alert("Error", res.detail ?? "Failed to log out");
        return;
      }
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to log out");
      return;
    }
    setAuthToken(null);
    await clearSession();
    logout();
  };
}
