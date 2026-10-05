import { Redirect, Stack, useSegments } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { CatererProvider, useCaterer } from "@/src/caterer";
import { useTheme } from "@/src/theme";

function Gate() {
  const { session, loading } = useCaterer();
  const { colors } = useTheme();
  const segments = useSegments();
  const onLogin = segments[segments.length - 1] === "login";

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (!session && !onLogin) return <Redirect href="/caterer/login" />;
  if (session && onLogin) return <Redirect href="/caterer" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="new-order" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function CatererLayout() {
  return (
    <CatererProvider>
      <Gate />
    </CatererProvider>
  );
}
