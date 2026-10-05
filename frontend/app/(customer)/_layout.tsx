import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import { ActivityIndicator, Platform, View } from "react-native";

import { useApp } from "@/src/store";
import { useTheme } from "@/src/theme";
import { IconName } from "@/src/ui";

export default function CustomerLayout() {
  const { session, loadingSession, cartCount } = useApp();
  const { colors } = useTheme();

  if (loadingSession) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (!session) return <Redirect href="/" />;

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
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: icon("home-outline"), tabBarButtonTestID: "tab-home" }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: icon("receipt-outline"), tabBarButtonTestID: "tab-orders" }} />
      <Tabs.Screen name="cart" options={{ title: "Cart", tabBarIcon: icon("basket-outline"), tabBarBadge: cartCount > 0 ? cartCount : undefined, tabBarButtonTestID: "tab-cart" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("person-outline"), tabBarButtonTestID: "tab-profile" }} />
    </Tabs>
  );
}
