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

// pickedOrders[invoiceNumber][itemCode] = count picked so far
type PickedOrders = Record<number, Record<string, number>>;

interface StoreActions {
  setUser: (user: User) => void;
  setItemPicked: (invoiceNumber: number, itemCode: string, count: number) => void;
  logout: () => void;
}

interface StoreState extends StoreActions {
  user: User;
  pickedOrders: PickedOrders;
}

const useStore = create<StoreState>((set) => ({
  user: emptyUser,
  pickedOrders: {},

  setUser: (user: User) => set({ user }),

  setItemPicked: (invoiceNumber, itemCode, count) =>
    set((state) => ({
      pickedOrders: {
        ...state.pickedOrders,
        [invoiceNumber]: {
          ...state.pickedOrders[invoiceNumber],
          [itemCode]: count,
        },
      },
    })),

  logout: () =>
    set({
      user: emptyUser,
      pickedOrders: {},
    }),
}));

export default useStore;
