import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Order, request } from "@/src/api";
import { useApp } from "@/src/store";
import { useTheme } from "@/src/theme";
import { useStyles } from "@/src/ui";

const STEPS = ["Order placed", "Preparing your order", "Ready for pickup", "Completed"];

const HEADLINE: Record<string, string> = {
  payment_pending: "Payment pending",
  placed: "Order placed!",
  accepted: "Order accepted",
  preparing: "Being prepared",
  ready: "Ready for pickup!",
  completed: "Order completed",
};

function stepIndex(status: string): number {
  if (status === "completed") return 3;
  if (status === "ready") return 2;
  if (status === "accepted" || status === "preparing") return 1;
  return 0;
}

const STEP_HINTS = ["We have your order", "Kitchen is on it", "Collect at the counter", "Enjoy your meal"];

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const { session, activeOrder } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const value = await request<Order[]>("/orders", {}, session.token);
      setOrders(value);
    } catch {
      // keep last known list
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const order = orders.find((item) => item.id === activeOrder?.id) ?? orders[0];
  const activeStep = order ? stepIndex(order.status) : 0;

  return (
    <ScrollView
      testID="orders-screen"
      style={styles.root}
      contentContainerStyle={[styles.screenContent, { paddingTop: insets.top + 20 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} tintColor={colors.brandPrimary} />}
    >
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>Order status</Text>
      </View>
      {order ? (
        <>
          <View style={styles.statusCard}>
            <Ionicons name={order.status === "completed" ? "checkmark-done-circle" : "checkmark-circle"} size={58} color={colors.brandPrimary} />
            <Text style={styles.screenTitle}>{HEADLINE[order.status] ?? "Order placed!"}</Text>
            <Text style={styles.detailDescription}>Your food is being prepared with care.</Text>
            <Text testID="active-order-number" style={styles.orderNumber}>{order.id}</Text>
          </View>
          <View style={styles.timeline}>
            {STEPS.map((step, index) => (
              <View key={step} style={styles.timelineRow}>
                <View style={[styles.timelineDot, index <= activeStep && styles.timelineDotActive]}>
                  <Ionicons name={index <= activeStep ? "checkmark" : "ellipse-outline"} size={12} color={index <= activeStep ? colors.onBrandPrimary : colors.muted} />
                </View>
                <View>
                  <Text style={styles.foodName}>{step}</Text>
                  <Text style={styles.foodCategory}>{index === activeStep ? STEP_HINTS[index] : index < activeStep ? "Done" : "We will notify you"}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.noticeCard}>
            <Ionicons name="notifications-outline" size={22} color={colors.brandPrimary} />
            <Text style={styles.foodCategory}>SMS and WhatsApp updates will follow when Twilio credentials are connected.</Text>
          </View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent orders</Text>
            <Text style={styles.sectionHint}>{orders.length}</Text>
          </View>
          <View style={styles.cartList}>
            {orders.map((item) => (
              <View key={item.id} testID={`order-row-${item.id}`} style={styles.cartItem}>
                <View style={styles.smallFoodArt}>
                  <Ionicons name="receipt-outline" size={22} color={colors.brandPrimary} />
                </View>
                <View style={styles.cartItemCopy}>
                  <Text style={styles.foodName}>{item.lines.map((line) => `${line.quantity}× ${line.name}`).join(", ")}</Text>
                  <Text style={styles.foodCategory}>{item.id} · {item.status}</Text>
                </View>
                <Text style={styles.foodPrice}>₹{item.amount}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={44} color={colors.brandSecondary} />
          <Text style={styles.emptyTitle}>No active orders</Text>
          <Text style={styles.emptyCopy}>Your next delicious order will show up here.</Text>
        </View>
      )}
    </ScrollView>
  );
}
