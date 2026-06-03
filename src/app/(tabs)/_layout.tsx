import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#208AEF",
        tabBarInactiveTintColor: "#999",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#E2DAD3",
          borderTopWidth: 1,
        },
        tabBarItemStyle: {
          paddingVertical: 10,
        },
        tabBarIconStyle: {
          height: 0,
        },
        tabBarLabelStyle: {
          fontSize: 15,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Orders", tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="products"
        options={{ title: "Products", tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="scanned"
        options={{ title: "Scanned", tabBarIcon: () => null }}
      />
    </Tabs>
  );
}
