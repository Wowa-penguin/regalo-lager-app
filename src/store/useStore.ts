import { User } from "@/types/user";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const SESSION_USER_KEY = "regalo_user_data";
const SESSION_TOKEN_KEY = "regalo_token";

export const saveSession = async (user: User, token?: string) => {
  await SecureStore.setItemAsync(SESSION_USER_KEY, JSON.stringify(user));
  if (token) await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
};

export const loadSession = async (): Promise<{ user: User; token: string | null } | null> => {
  const json = await SecureStore.getItemAsync(SESSION_USER_KEY);
  if (!json) return null;
  const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  return { user: JSON.parse(json) as User, token: token ?? null };
};

export const clearSession = async () => {
  await SecureStore.deleteItemAsync(SESSION_USER_KEY);
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
};

const emptyUser: User = {
  username: "",
};

interface StoreActions {
  setUser: (user: User) => void;
  logout: () => void;
}

interface StoreState extends StoreActions {
  user: User;
}

const useStore = create<StoreState>((set) => ({
  user: emptyUser,

  setUser: (user: User) => set({ user }),
  logout: () =>
    set({
      user: emptyUser,
    }),
}));

export default useStore;
