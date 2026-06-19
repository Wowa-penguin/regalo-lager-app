import { fetchBarcodes } from "@/api/fetchBarcodes";
import { fetchLogin } from "@/api/fetchLogin";
import { fetchUsers } from "@/api/fetchUsers";
import useBarcodeStore from "@/store/useBarcodeStore";
import useStore, { saveSession } from "@/store/useStore";
import { setAuthToken } from "@/utils/auth";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Login() {
  const username = useStore((s) => s.user.username);
  const setUser = useStore((s) => s.setUser);
  const setBarcodes = useBarcodeStore((s) => s.setBarcodes);

  const [users, setUsers] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [signingInAs, setSigningInAs] = useState<string | null>(null);
  const [signInError, setSignInError] = useState("");

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : "Failed to load users"),
      )
      .finally(() => setLoadingUsers(false));
  }, []);

  if (username) return <Redirect href="/" />;

  const handleSelect = async (selected: string) => {
    setSigningInAs(selected);
    setSignInError("");
    try {
      const res = await fetchLogin(selected);
      const user = { username: res.username };
      setUser(user);
      setAuthToken(res.token);
      await saveSession(user, res.token);
      fetchBarcodes()
        .then(setBarcodes)
        .catch(() => {});
      router.replace("/");
    } catch (e: unknown) {
      setSignInError(e instanceof Error ? e.message : "Something went wrong.");
      setSigningInAs(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Regalo Lager</Text>
        <Text style={styles.subtitle}>Veldu notanda til að halda áfram</Text>
      </View>

      {!!signInError && <Text style={styles.error}>{signInError}</Text>}

      {loadingUsers ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : loadError ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{loadError}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.userCard, signingInAs === item && styles.userCardDisabled]}
              onPress={() => handleSelect(item)}
              disabled={signingInAs !== null}
            >
              <Text style={styles.userName}>{item}</Text>
              {signingInAs === item ? (
                <ActivityIndicator color="#208AEF" size="small" />
              ) : (
                <Text style={styles.userChevron}>›</Text>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>Engir notendur fundust.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F5F2",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: {
    color: "#aaa",
    fontSize: 15,
    textAlign: "center",
  },
  error: {
    color: "#C0392B",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 1,
  },
  userCardDisabled: {
    opacity: 0.6,
  },
  userName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  userChevron: {
    fontSize: 22,
    color: "#C0C0C0",
  },
});
