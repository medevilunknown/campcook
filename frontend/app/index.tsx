import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { post, request } from "@/src/api";
import { Session, useApp } from "@/src/store";
import { useTheme } from "@/src/theme";
import { useStyles } from "@/src/ui";

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { session, loadingSession, signIn } = useApp();
  const [role, setRole] = useState<"student" | "staff">("student");
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const handleSignIn = async () => {
    if (!identifier.trim()) {
      setMessage("Enter your student/staff ID or email.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await post<Session>("/auth/login", { identifier, role, phone_number: phone || undefined });
      await signIn(result);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    if (!phone.trim()) {
      setMessage("Add a phone number in international format first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await post("/twilio/otp/send", { phone_number: phone });
      setOtpSent(true);
      setMessage("Code sent. Check your phone.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    try {
      const result = await request<{ available: boolean; message?: string }>("/auth/google");
      setMessage(result.available ? "Open the managed Google sign-in from your project callback." : result.message ?? "Google sign-in is not configured yet.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  if (loadingSession) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (session) return <Redirect href="/home" />;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView testID="welcome-screen" contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoMark}>
          <Ionicons name="restaurant-outline" size={34} color={colors.onBrandPrimary} />
        </View>
        <Text style={styles.eyebrow}>CAMPCOOK CANTEEN</Text>
        <Text style={styles.heroTitle}>Good Food,{"\n"}Brighter Days.</Text>
        <Text style={styles.heroCopy}>Quick, fresh and delicious meals for your campus day.</Text>
        <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} style={styles.authCard}>
          <Text style={styles.cardLabel}>Welcome back</Text>
          <View style={styles.roleSwitch}>
            {(["student", "staff"] as const).map((value) => (
              <Pressable key={value} testID={`role-${value}-button`} onPress={() => setRole(value)} style={[styles.roleButton, role === value && styles.roleButtonActive]}>
                <Text style={[styles.roleText, role === value && styles.roleTextActive]}>{value[0].toUpperCase() + value.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput testID="signin-identifier-input" value={identifier} onChangeText={setIdentifier} placeholder={role === "student" ? "Student ID or email" : "Staff ID or email"} placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" />
          <View style={styles.phoneRow}>
            <TextInput testID="signin-phone-input" value={phone} onChangeText={setPhone} placeholder="Phone for SMS updates" placeholderTextColor={colors.muted} style={[styles.input, styles.phoneInput]} keyboardType="phone-pad" />
            <Pressable testID="send-otp-button" onPress={sendOtp} style={({ pressed }) => [styles.otpButton, pressed && styles.pressed]}>
              <Text style={styles.otpText}>{otpSent ? "Resend" : "Send code"}</Text>
            </Pressable>
          </View>
          {otpSent && <TextInput testID="otp-code-input" value={otp} onChangeText={setOtp} placeholder="Enter SMS code" placeholderTextColor={colors.muted} style={styles.input} keyboardType="number-pad" />}
          {!!message && <Text testID="auth-message" style={styles.formMessage}>{message}</Text>}
          <Pressable testID="continue-button" onPress={handleSignIn} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} disabled={busy}>
            <Text style={styles.primaryButtonText}>{busy ? "Please wait..." : "Continue to campcook"}</Text>
          </Pressable>
          <View style={styles.orLine}>
            <View style={styles.line} />
            <Text style={styles.orText}>or continue with</Text>
            <View style={styles.line} />
          </View>
          <Pressable testID="google-signin-button" onPress={google} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}>
            <Ionicons name="logo-google" size={18} color={colors.error} />
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>
        </LinearGradient>
        <Text style={styles.privacy}>By continuing, you agree to your campus dining terms.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
