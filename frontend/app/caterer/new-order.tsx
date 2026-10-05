import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MenuItem, post, request } from "@/src/api";
import { useCaterer } from "@/src/caterer";
import { makeStyles, useTheme } from "@/src/theme";

const METHODS = [
  { key: "cash", label: "Cash" },
  { key: "upi", label: "UPI" },
  { key: "card", label: "Card" },
] as const;

export default function NewOfflineOrderScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { session } = useCaterer();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<"cash" | "upi" | "card">("cash");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid">("paid");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const value = await request<MenuItem[]>("/caterer/menu", {}, session.token);
      setMenu(value.filter((item) => (item as MenuItem & { available?: boolean }).available !== false));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const chosen = menu.filter((item) => quantities[item.id]);
  const total = chosen.reduce((sum, item) => sum + item.price * (quantities[item.id] ?? 0), 0);

  const bump = (item: MenuItem, delta: number) => {
    setQuantities((current) => {
      const next = Math.max(0, (current[item.id] ?? 0) + delta);
      const updated = { ...current };
      if (next === 0) delete updated[item.id];
      else updated[item.id] = next;
      return updated;
    });
  };

  const save = async () => {
    if (!session) return;
    if (customerName.trim().length < 2) return setMessage("Add the customer name.");
    if (customerPhone.trim().length < 8) return setMessage("Add a valid customer phone number.");
    if (!chosen.length) return setMessage("Add at least one dish to the bill.");
    setBusy(true);
    setMessage("");
    try {
      await post(
        "/caterer/offline-orders",
        {
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          items: chosen.map((item) => ({ item_id: item.id, quantity: quantities[item.id] })),
          payment_method: method,
          payment_status: paymentStatus,
          pickup_time: pickupTime.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        session.token,
      );
      router.back();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top + 12 }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable testID="new-order-close" onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>New offline bill</Text>
      </View>
      <ScrollView testID="new-order-screen" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Customer</Text>
        <TextInput testID="customer-name-input" value={customerName} onChangeText={setCustomerName} placeholder="Customer name" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput testID="customer-phone-input" value={customerPhone} onChangeText={setCustomerPhone} placeholder="Contact number" placeholderTextColor={colors.muted} style={styles.input} keyboardType="phone-pad" />
        <TextInput testID="pickup-time-input" value={pickupTime} onChangeText={setPickupTime} placeholder="Pickup time (e.g. 12:30 PM)" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput testID="notes-input" value={notes} onChangeText={setNotes} placeholder="Customer notes (optional)" placeholderTextColor={colors.muted} style={[styles.input, styles.notesInput]} multiline />

        <Text style={styles.sectionTitle}>Payment</Text>
        <View style={styles.chipRowWrap}>
          {METHODS.map((item) => (
            <Pressable key={item.key} testID={`payment-method-${item.key}`} onPress={() => setMethod(item.key)} style={[styles.chip, method === item.key && styles.chipActive]}>
              <Text style={[styles.chipText, method === item.key && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.chipRowWrap}>
          {(["paid", "unpaid"] as const).map((value) => (
            <Pressable key={value} testID={`payment-status-${value}`} onPress={() => setPaymentStatus(value)} style={[styles.chip, paymentStatus === value && styles.chipActive]}>
              <Text style={[styles.chipText, paymentStatus === value && styles.chipTextActive]}>{value === "paid" ? "Paid now" : "Collect later"}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Dishes</Text>
        {menu.map((item) => {
          const count = quantities[item.id] ?? 0;
          return (
            <View key={item.id} testID={`bill-item-${item.id}`} style={styles.itemRow}>
              <View style={styles.itemCopy}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>₹{item.price}</Text>
              </View>
              <View style={styles.stepper}>
                {count > 0 && (
                  <Pressable testID={`bill-minus-${item.id}`} onPress={() => bump(item, -1)} style={styles.stepButton}>
                    <Ionicons name="remove" size={16} color={colors.onSurface} />
                  </Pressable>
                )}
                {count > 0 && <Text testID={`bill-count-${item.id}`} style={styles.quantity}>{count}</Text>}
                <Pressable testID={`bill-plus-${item.id}`} onPress={() => bump(item, 1)} style={[styles.stepButton, styles.stepButtonAdd]}>
                  <Ionicons name="add" size={16} color={colors.onBrandPrimary} />
                </Pressable>
              </View>
            </View>
          );
        })}
        {!!message && <Text testID="new-order-message" style={styles.errorText}>{message}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <View>
          <Text style={styles.footerLabel}>TOTAL</Text>
          <Text testID="bill-total" style={styles.footerTotal}>₹{total}</Text>
        </View>
        <Pressable testID="save-bill-button" onPress={save} disabled={busy} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, busy && styles.saveBusy]}>
          <Ionicons name="receipt-outline" size={19} color={colors.onBrandPrimary} />
          <Text style={styles.saveText}>{busy ? "Saving..." : "Save bill"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 10 },
    backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
    title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
    content: { padding: 20, gap: 12, paddingBottom: 24 },
    sectionTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800", marginTop: 6 },
    input: { minHeight: 48, borderRadius: 11, backgroundColor: colors.surfaceSecondary, paddingHorizontal: 14, color: colors.onSurface, fontSize: 14 },
    notesInput: { minHeight: 68, textAlignVertical: "top", paddingTop: 13 },
    chipRowWrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    chip: { height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.surfaceSecondary, justifyContent: "center" },
    chipActive: { backgroundColor: colors.brandPrimary },
    chipText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
    chipTextActive: { color: colors.onBrandPrimary },
    itemRow: { minHeight: 58, backgroundColor: colors.surfaceSecondary, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10 },
    itemCopy: { flex: 1 },
    itemName: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
    itemPrice: { color: colors.muted, fontSize: 12, marginTop: 2 },
    stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
    stepButton: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
    stepButtonAdd: { backgroundColor: colors.brandPrimary },
    quantity: { color: colors.onSurface, fontWeight: "800", minWidth: 16, textAlign: "center" },
    errorText: { color: colors.error, fontSize: 12 },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface, gap: 14 },
    footerLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
    footerTotal: { color: colors.brandPrimary, fontSize: 22, fontWeight: "900" },
    saveButton: { flex: 1, minHeight: 50, borderRadius: 13, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    saveBusy: { opacity: 0.6 },
    saveText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 15 },
    pressed: { opacity: 0.8 },
  }),
);
