import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/store";
import { useTheme } from "@/src/theme";
import { IconName, useStyles } from "@/src/ui";
import { storage } from "@/src/utils/storage";

const PICKUP_KEY = "campcook.pickup";
const PICKUP_OPTIONS = ["Main canteen counter", "Hostel block desk", "Library cafe counter"];

type SheetKind = "pickup" | "payments" | "help" | null;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { session, signOut } = useApp();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [pickup, setPickup] = useState(PICKUP_OPTIONS[0]);

  useEffect(() => {
    storage.getItem(PICKUP_KEY, PICKUP_OPTIONS[0]).then((value) => setPickup(value ?? PICKUP_OPTIONS[0]));
  }, []);

  if (!session) return null;
  const user = session.user;

  const rows: { key: string; label: string; icon: IconName; onPress: () => void }[] = [
    { key: "orders", label: "My orders", icon: "receipt-outline", onPress: () => router.push("/orders") },
    { key: "pickup", label: "Pickup preferences", icon: "location-outline", onPress: () => setSheet("pickup") },
    { key: "payments", label: "Payment methods", icon: "card-outline", onPress: () => setSheet("payments") },
    { key: "help", label: "Help & support", icon: "help-circle-outline", onPress: () => setSheet("help") },
  ];

  const choosePickup = async (option: string) => {
    setPickup(option);
    await storage.setItem(PICKUP_KEY, option);
    setSheet(null);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <ScrollView testID="profile-screen" style={styles.root} contentContainerStyle={[styles.screenContent, { paddingTop: insets.top + 20 }]}>
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Ionicons name="person" size={34} color={colors.brandPrimary} />
        </View>
        <Text style={styles.screenTitle}>{String(user.name ?? "Campus guest")}</Text>
        <Text style={styles.foodCategory}>{String(user.role ?? "student")} · {String(user.identifier ?? "")}</Text>
      </View>
      <View style={styles.balanceCard}>
        <View>
          <Text style={[styles.cardLabel, { color: colors.onBrandTertiary }]}>CAMPUS WALLET</Text>
          <Text style={styles.balance}>₹{String(user.meal_balance ?? 250)}</Text>
          <Text style={styles.foodCategory}>Available meal balance</Text>
        </View>
        <Ionicons name="wallet-outline" size={38} color={colors.brandPrimary} />
      </View>
      <View style={styles.cartItem}>
        <Ionicons name="location-outline" size={21} color={colors.brandPrimary} />
        <View style={styles.cartItemCopy}>
          <Text style={styles.foodName}>Pickup point</Text>
          <Text testID="pickup-preference-value" style={styles.foodCategory}>{pickup}</Text>
        </View>
      </View>
      {rows.map((row) => (
        <Pressable key={row.key} testID={`profile-row-${row.key}`} onPress={row.onPress} style={({ pressed }) => [styles.profileRow, pressed && styles.pressed]}>
          <Ionicons name={row.icon} size={21} color={colors.brandPrimary} />
          <Text style={styles.profileRowText}>{row.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      ))}
      <View style={styles.twilioCard}>
        <View style={styles.twilioIcon}>
          <Ionicons name="chatbubbles-outline" size={22} color={colors.onBrandTertiary} />
        </View>
        <View style={styles.paymentCopy}>
          <Text style={styles.foodName}>Order notifications</Text>
          <Text style={styles.foodCategory}>SMS + WhatsApp via Twilio</Text>
        </View>
        <Text style={styles.pendingPill}>READY</Text>
      </View>
      <Pressable testID="sign-out-button" onPress={handleSignOut} style={styles.signOut}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSheet(null)}>
          <Pressable testID="profile-sheet" style={styles.modalCard} onPress={() => undefined}>
            {sheet === "pickup" && (
              <>
                <Text style={styles.modalTitle}>Pickup preferences</Text>
                <Text style={styles.modalBody}>Choose where you would like to collect your orders.</Text>
                {PICKUP_OPTIONS.map((option) => (
                  <Pressable key={option} testID={`pickup-option-${option.toLowerCase().replace(/\s+/g, "-")}`} onPress={() => choosePickup(option)} style={[styles.modalOption, pickup === option && styles.modalOptionActive]}>
                    <Ionicons name={pickup === option ? "radio-button-on" : "radio-button-off"} size={20} color={pickup === option ? colors.brandPrimary : colors.muted} />
                    <Text style={styles.modalOptionText}>{option}</Text>
                  </Pressable>
                ))}
              </>
            )}
            {sheet === "payments" && (
              <>
                <Text style={styles.modalTitle}>Payment methods</Text>
                <Text style={styles.modalBody}>Pay online with Razorpay (UPI, cards, wallets, net banking) or choose cash at the counter when you collect your order. Razorpay activates once the campus adds its keys.</Text>
                <View style={styles.modalOption}>
                  <Ionicons name="card-outline" size={20} color={colors.brandPrimary} />
                  <Text style={styles.modalOptionText}>Razorpay · UPI, cards, wallets</Text>
                </View>
                <View style={styles.modalOption}>
                  <Ionicons name="cash-outline" size={20} color={colors.brandPrimary} />
                  <Text style={styles.modalOptionText}>Cash at counter</Text>
                </View>
              </>
            )}
            {sheet === "help" && (
              <>
                <Text style={styles.modalTitle}>Help & support</Text>
                <Text style={styles.modalBody}>Facing an issue with an order or payment? Reach the campus dining team and we will sort it out.</Text>
                <View style={styles.modalOption}>
                  <Ionicons name="mail-outline" size={20} color={colors.brandPrimary} />
                  <Text style={styles.modalOptionText}>support@campcook.in</Text>
                </View>
                <View style={styles.modalOption}>
                  <Ionicons name="call-outline" size={20} color={colors.brandPrimary} />
                  <Text style={styles.modalOptionText}>+91 98000 12345 · 9am – 6pm</Text>
                </View>
              </>
            )}
            <Pressable testID="sheet-close-button" onPress={() => setSheet(null)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
