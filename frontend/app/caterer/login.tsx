import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { post } from "@/src/api";
import { CatererSession, useCaterer } from "@/src/caterer";
import { useTheme } from "@/src/theme";
import { useStyles } from "@/src/ui";

export default function CatererLoginScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { signIn } = useCaterer();
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    if (!identifier.trim()) {
      setMessage("Enter your staff ID or email.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await post<CatererSession>("/caterer/login", { identifier });
      await signIn(result);
      router.replace("/caterer");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView testID="caterer-login-screen" contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoMark}>
          <Ionicons name="flame-outline" size={34} color={colors.onBrandPrimary} />
        </View>
        <Text style={styles.eyebrow}>CAMPCOOK KITCHEN</Text>
        <Text style={styles.heroTitle}>Caterer{"\n"}workspace.</Text>
        <Text style={styles.heroCopy}>Live queue, menu control and offline billing for the kitchen team.</Text>
        <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} style={styles.authCard}>
          <Text style={styles.cardLabel}>Staff sign in</Text>
          <TextInput testID="caterer-id-input" value={identifier} onChangeText={setIdentifier} placeholder="Staff ID (e.g. CAT1001) or email" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" />
          {!!message && <Text testID="caterer-login-message" style={styles.formMessage}>{message}</Text>}
          <Pressable testID="caterer-login-button" onPress={handleLogin} disabled={busy} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
            <Text style={[styles.primaryButtonText, { color: colors.brandPrimary }]}>{busy ? "Authenticating..." : "Enter kitchen"}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.brandPrimary} />
          </Pressable>
        </LinearGradient>
        <Text style={styles.privacy}>Kitchen access is restricted to authorised catering staff.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
