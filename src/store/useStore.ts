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

type OrderCounts = Record<number, Record<string, number>>;

interface StoreActions {
  setUser: (user: User) => void;
  setItemPicked: (invoiceNumber: number, itemCode: string, count: number) => void;
  setItemMissing: (invoiceNumber: number, itemCode: string, count: number) => void;
  clearOrderProgress: () => void;
  logout: () => void;
}

interface StoreState extends StoreActions {
  user: User;
  pickedOrders: OrderCounts;
  missingOrders: OrderCounts;
}

const useStore = create<StoreState>((set) => ({
  user: emptyUser,
  pickedOrders: {},
  missingOrders: {},

  setUser: (user: User) => set({ user }),

  setItemPicked: (invoiceNumber, itemCode, count) =>
    set((state) => ({
      pickedOrders: {
        ...state.pickedOrders,
        [invoiceNumber]: { ...state.pickedOrders[invoiceNumber], [itemCode]: count },
      },
    })),

  setItemMissing: (invoiceNumber, itemCode, count) =>
    set((state) => ({
      missingOrders: {
        ...state.missingOrders,
        [invoiceNumber]: { ...state.missingOrders[invoiceNumber], [itemCode]: count },
      },
    })),

  clearOrderProgress: () => set({ pickedOrders: {}, missingOrders: {} }),

  logout: () =>
    set({
      user: emptyUser,
      pickedOrders: {},
      missingOrders: {},
    }),
}));

export default useStore;
