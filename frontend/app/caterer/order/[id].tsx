import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { post, request } from "@/src/api";
import { formatTime, KitchenOrder, NEXT_ACTION, PAYMENT_LABEL, STATUS_LABEL, statusTone, useCaterer } from "@/src/caterer";
import { makeStyles, useTheme } from "@/src/theme";
import { IconName } from "@/src/ui";

export default function OrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useCaterer();
  const [order, setOrder] = useState<KitchenOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session || !id) return;
    try {
      const value = await request<KitchenOrder>(`/caterer/orders/${id}`, {}, session.token);
      setOrder(value);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [session, id]);

  useEffect(() => {
    load();
  }, [load]);

  const transition = async () => {
    if (!order || !session) return;
    const action = NEXT_ACTION[order.status];
    if (!action) return;
    setBusy(true);
    try {
      await post(`/caterer/orders/${order.id}/status`, { status: action.next }, session.token);
      if (Platform.OS !== "web") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const action = order ? NEXT_ACTION[order.status] : null;
  const tone = order ? statusTone(colors, order.status) : { bg: colors.surfaceSecondary, fg: colors.onSurfaceSecondary };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable testID="order-detail-back" onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Order detail</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : !order ? (
        <View style={styles.center}>
          <Text testID="order-detail-error" style={styles.errorText}>{error || "Order details not found."}</Text>
        </View>
      ) : (
        <>
          <ScrollView testID="order-detail-screen" contentContainerStyle={[styles.content, { paddingBottom: 120 }]}>
            <View style={styles.idRow}>
              <Text testID="order-detail-id" style={styles.orderId}>{order.id}</Text>
              <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                <Text style={[styles.statusPillText, { color: tone.fg }]}>{STATUS_LABEL[order.status] ?? order.status}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.contactRow}>
                <View style={styles.avatarCircle}>
                  <Ionicons name="person" size={20} color={colors.brandPrimary} />
                </View>
                <View style={styles.contactCopy}>
                  <Text style={styles.contactName}>{order.customer_name ?? "App customer"}</Text>
                  <Text style={styles.contactMeta}>{order.customer_phone ?? "No phone shared"}</Text>
                </View>
                {!!order.customer_phone && (
                  <Pressable testID="call-customer-button" onPress={() => Linking.openURL(`tel:${order.customer_phone}`)} style={styles.callButton} hitSlop={6}>
                    <Ionicons name="call" size={18} color={colors.onBrandPrimary} />
                  </Pressable>
                )}
              </View>
              <View style={styles.metaLine}>
                <Ionicons name="time-outline" size={14} color={colors.muted} />
                <Text style={styles.metaText}>Placed {formatTime(order.created_at)}{order.pickup_time ? ` · Pickup ${order.pickup_time}` : ""}</Text>
              </View>
              <View style={styles.metaLine}>
                <Ionicons name="card-outline" size={14} color={colors.muted} />
                <Text style={styles.metaText}>{PAYMENT_LABEL[order.payment_method] ?? order.payment_method} · {order.payment_status ?? "pending"}</Text>
              </View>
              <View style={styles.metaLine}>
                <Ionicons name={order.source === "offline" ? "storefront-outline" : "phone-portrait-outline"} size={14} color={colors.muted} />
                <Text style={styles.metaText}>{order.source === "offline" ? "Offline counter bill" : "App order"}</Text>
              </View>
            </View>

            {!!order.notes && (
              <View style={styles.notesCard}>
                <Ionicons name="chatbox-ellipses-outline" size={18} color={colors.warning} />
                <Text testID="order-notes" style={styles.notesText}>{order.notes}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Items</Text>
            <View style={styles.card}>
              {order.lines.map((line, index) => (
                <View key={`${line.name}-${index}`} style={styles.lineRow}>
                  <Text style={styles.lineQty}>{line.quantity}×</Text>
                  <Text style={styles.lineName}>{line.name}</Text>
                  <Text style={styles.linePrice}>₹{line.unit_price * line.quantity}</Text>
                </View>
              ))}
              <View style={styles.divider} />
              <View style={styles.lineRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text testID="order-total" style={styles.totalValue}>₹{order.amount}</Text>
              </View>
            </View>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>

          <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
            {action ? (
              <Pressable testID="order-status-action" onPress={transition} disabled={busy} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed, busy && styles.actionBusy]}>
                <Ionicons name={action.icon as IconName} size={19} color={colors.onBrandPrimary} />
                <Text style={styles.actionText}>{busy ? "Updating..." : action.label}</Text>
              </Pressable>
            ) : (
              <View testID="order-complete-banner" style={[styles.actionButton, styles.actionDone]}>
                <Ionicons name="checkmark-done" size={19} color={colors.onSurfaceTertiary} />
                <Text style={[styles.actionText, { color: colors.onSurfaceTertiary }]}>Order completed</Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 8 },
    backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
    title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
    content: { padding: 20, gap: 14 },
    idRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    orderId: { color: colors.onSurface, fontSize: 22, fontWeight: "900" },
    statusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    statusPillText: { fontSize: 12, fontWeight: "900" },
    card: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16, gap: 10 },
    contactRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
    contactCopy: { flex: 1 },
    contactName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    contactMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
    callButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
    metaLine: { flexDirection: "row", alignItems: "center", gap: 8 },
    metaText: { color: colors.onSurfaceSecondary, fontSize: 13 },
    notesCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: colors.brandTertiary, borderRadius: 14, padding: 14 },
    notesText: { color: colors.onBrandTertiary, fontSize: 13, flex: 1, lineHeight: 19 },
    sectionTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
    lineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    lineQty: { color: colors.brandPrimary, fontSize: 14, fontWeight: "900", width: 32 },
    lineName: { color: colors.onSurface, fontSize: 14, fontWeight: "600", flex: 1 },
    linePrice: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
    divider: { height: 1, backgroundColor: colors.divider },
    totalLabel: { color: colors.onSurface, fontSize: 15, fontWeight: "800", flex: 1 },
    totalValue: { color: colors.brandPrimary, fontSize: 17, fontWeight: "900" },
    errorText: { color: colors.error, fontSize: 12 },
    actionBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
    actionButton: { minHeight: 50, borderRadius: 13, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    actionBusy: { opacity: 0.6 },
    actionDone: { backgroundColor: colors.surfaceTertiary },
    actionText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 15 },
    pressed: { opacity: 0.8 },
  }),
);
