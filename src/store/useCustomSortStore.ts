import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const SORT_CONFIG_KEY = "regalo_custom_sort";

export type CategoryOrder = Record<string, string[]>;

interface CustomSortState {
  categoryOrder: CategoryOrder;
  setCategoryOrder: (category: string, itemCodes: string[]) => void;
  clearCategoryOrder: (category: string) => void;
  loadPersistedSort: () => Promise<void>;
}

const useCustomSortStore = create<CustomSortState>((set, get) => ({
  categoryOrder: {},

  setCategoryOrder: (category, itemCodes) => {
    const next = { ...get().categoryOrder, [category]: itemCodes };
    set({ categoryOrder: next });
    SecureStore.setItemAsync(SORT_CONFIG_KEY, JSON.stringify(next)).catch(() => {});
  },

  clearCategoryOrder: (category) => {
    const next = { ...get().categoryOrder };
    delete next[category];
    set({ categoryOrder: next });
    SecureStore.setItemAsync(SORT_CONFIG_KEY, JSON.stringify(next)).catch(() => {});
  },

  loadPersistedSort: async () => {
    const json = await SecureStore.getItemAsync(SORT_CONFIG_KEY);
    if (json) {
      set({ categoryOrder: JSON.parse(json) as CategoryOrder });
    }
  },
}));

export default useCustomSortStore;
