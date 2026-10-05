import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

import { useTheme } from "@/src/theme";
import { IconName } from "@/src/ui";

export default function CatererTabsLayout() {
  const { colors } = useTheme();

  const icon = (name: IconName) =>
    function TabIcon({ color, focused }: { color: string; focused: boolean }) {
      return <Ionicons name={focused ? (name.replace("-outline", "") as IconName) : name} size={22} color={color} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.divider, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarIcon: icon("speedometer-outline"), tabBarButtonTestID: "caterer-tab-today" }} />
      <Tabs.Screen name="queue" options={{ title: "Queue", tabBarIcon: icon("layers-outline"), tabBarButtonTestID: "caterer-tab-queue" }} />
      <Tabs.Screen name="menu" options={{ title: "Menu", tabBarIcon: icon("restaurant-outline"), tabBarButtonTestID: "caterer-tab-menu" }} />
      <Tabs.Screen name="sales" options={{ title: "Sales", tabBarIcon: icon("bar-chart-outline"), tabBarButtonTestID: "caterer-tab-sales" }} />
    </Tabs>
  );
}
