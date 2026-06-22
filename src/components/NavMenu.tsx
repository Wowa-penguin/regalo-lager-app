import { router, usePathname } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

const NAV_ITEMS: { label: string; path: "/" | "/products" | "/scanned" | "/sort" }[] = [
  { label: "Pantanir", path: "/" },
  { label: "Skrá", path: "/products" },
  { label: "Breyta", path: "/scanned" },
  { label: "Röðun", path: "/sort" },
];

interface Props {
  onLogout: () => void;
}

export default function NavMenu({ onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const go = (path: string) => {
    setOpen(false);
    if (path !== pathname) router.replace(path as never);
  };

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>☰ Valmynd</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {NAV_ITEMS.map((item) => (
              <Pressable
                key={item.path}
                style={[
                  styles.menuItem,
                  pathname === item.path && styles.menuItemActive,
                ]}
                onPress={() => go(item.path)}
              >
                <Text
                  style={[
                    styles.menuItemText,
                    pathname === item.path && styles.menuItemTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
            <View style={styles.divider} />
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <Text style={styles.logoutItemText}>Skrá út</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 8,
  },
  triggerText: {
    color: "#1a1a1a",
    fontSize: 14,
    fontWeight: "600",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "flex-end",
    paddingTop: 70,
    paddingRight: 16,
  },
  menu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    minWidth: 180,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  menuItem: {
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  menuItemActive: {
    backgroundColor: "#EBF4FF",
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  menuItemTextActive: {
    color: "#208AEF",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2DAD3",
    marginVertical: 4,
  },
  logoutItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#C0392B",
  },
});
