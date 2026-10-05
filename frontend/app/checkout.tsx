import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Order, post } from "@/src/api";
import { useApp } from "@/src/store";
import { useTheme } from "@/src/theme";
import { IconName, useStyles } from "@/src/ui";

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { session, menu, cart, clearCart, setActiveOrder } = useApp();
  const [method, setMethod] = useState<"razorpay" | "cash">("razorpay");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const items = menu.filter((item) => cart[item.id]);
  const total = items.reduce((sum, item) => sum + item.price * (cart[item.id] ?? 0), 0);

  if (!session || !items.length) return <Redirect href="/home" />;

  const finish = (order: Order) => {
    setActiveOrder(order);
    clearCart();
    router.replace("/orders");
  };

  const placeOrder = async () => {
    setBusy(true);
    setMessage("");
    const body = { items: items.map((item) => ({ item_id: item.id, quantity: cart[item.id] })), payment_method: method };
    try {
      if (method === "cash") {
        const order = await post<Order>("/orders", body, session.token);
        finish(order);
        return;
      }
      const payment = await post<{ order_id: string; razorpay_order_id: string; amount: number; currency: string; key_id: string }>("/payments/razorpay/order", body, session.token);
      if (Platform.OS === "web") throw new Error("Razorpay checkout needs the Android or iOS app build.");
      const RazorpayCheckout = (await import("react-native-razorpay")).default;
      const result = await RazorpayCheckout.open({ key: payment.key_id, amount: payment.amount, currency: payment.currency, name: "campcook", description: "Campus canteen order", order_id: payment.razorpay_order_id, theme: { color: colors.brandPrimary } });
      await post("/payments/razorpay/verify", result, session.token);
      finish({ id: payment.order_id, amount: total, payment_method: "razorpay", status: "placed", created_at: new Date().toISOString(), lines: items.map((item) => ({ name: item.name, quantity: cart[item.id], unit_price: item.price })) });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView testID="checkout-screen" style={styles.root} contentContainerStyle={[styles.screenContent, { paddingTop: insets.top + 20 }]}>
      <View style={styles.titleRow}>
        <Pressable testID="checkout-back-button" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.screenTitle}>Payment method</Text>
      </View>
      <Text style={styles.sectionTitle}>Choose how to pay</Text>
      <View style={styles.paymentList}>
        <PaymentOption testID="pay-razorpay" icon="card-outline" title="Razorpay" subtitle="UPI, cards, wallets and net banking" selected={method === "razorpay"} onPress={() => setMethod("razorpay")} />
        <PaymentOption testID="pay-cash" icon="cash-outline" title="Cash at counter" subtitle="Pay when you collect your order" selected={method === "cash"} onPress={() => setMethod("cash")} />
      </View>
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.foodCategory}>Bill summary</Text>
          <Text style={styles.foodCategory}>{items.length} dishes</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total amount</Text>
          <Text testID="checkout-total" style={styles.totalValue}>₹{total}</Text>
        </View>
      </View>
      {!!message && <Text testID="checkout-message" style={styles.errorText}>{message}</Text>}
      <Pressable testID="place-order-button" onPress={placeOrder} disabled={busy} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>{busy ? "Processing..." : method === "cash" ? "Place order" : `Pay ₹${total} securely`}</Text>
      </Pressable>
      <Text style={styles.secureNote}>
        <Ionicons name="shield-checkmark-outline" size={15} color={colors.brandPrimary} /> Your payment is protected by Razorpay.
      </Text>
    </ScrollView>
  );
}

function PaymentOption({ testID, icon, title, subtitle, selected, onPress }: { testID: string; icon: IconName; title: string; subtitle: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.paymentOption, selected && styles.paymentSelected]}>
      <Ionicons name={icon} size={25} color={selected ? colors.brandPrimary : colors.muted} />
      <View style={styles.paymentCopy}>
        <Text style={styles.foodName}>{title}</Text>
        <Text style={styles.foodCategory}>{subtitle}</Text>
      </View>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={selected ? colors.brandPrimary : colors.borderStrong} />
    </Pressable>
  );
}
