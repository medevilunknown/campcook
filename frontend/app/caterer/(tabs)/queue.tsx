import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { post, request } from "@/src/api";
import { formatTime, KitchenOrder, NEXT_ACTION, PAYMENT_LABEL, STATUS_LABEL, statusTone, useCaterer } from "@/src/caterer";
import { makeStyles, ThemeColors, useTheme } from "@/src/theme";
import { IconName } from "@/src/ui";

const FILTERS = [
  { key: "all", label: "All", param: "" },
  { key: "new", label: "New", param: "new" },
  { key: "prep", label: "Prep", param: "prep" },
  { key: "ready", label: "Ready", param: "ready" },
  { key: "done", label: "Done", param: "done" },
];

export default function QueueScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const { session } = useCaterer();
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(
    async (filterKey: string) => {
      if (!session) return;
      const param = FILTERS.find((item) => item.key === filterKey)?.param ?? "";
      try {
        const value = await request<KitchenOrder[]>(`/caterer/orders${param ? `?status=${param}` : ""}`, {}, session.token);
        setOrders(value);
        setError("");
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [session],
  );

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [load, filter]),
  );

  const transition = async (order: KitchenOrder) => {
    const action = NEXT_ACTION[order.status];
    if (!action || !session || busyId) return;
    setBusyId(order.id);
    try {
      await post(`/caterer/orders/${order.id}/status`, { status: action.next }, session.token);
      if (Platform.OS !== "web") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load(filter);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId("");
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>LIVE KITCHEN</Text>
        <Text style={styles.title}>Order queue</Text>
      </View>
      <FlatList
        testID="queue-list"
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(filter).finally(() => setRefreshing(false)); }} tintColor={colors.brandPrimary} />}
        ListHeaderComponent={
          <View>
            <FlatList
              horizontal
              data={FILTERS}
              keyExtractor={(item) => item.key}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item }) => (
                <Pressable testID={`queue-filter-${item.key}`} onPress={() => setFilter(item.key)} style={[styles.chip, filter === item.key && styles.chipActive]}>
                  <Text style={[styles.chipText, filter === item.key && styles.chipTextActive]}>{item.label}</Text>
                </Pressable>
              )}
            />
            {!!error && <Text testID="queue-error" style={styles.errorText}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="leaf-outline" size={34} color={colors.brandSecondary} />
            <Text style={styles.emptyTitle}>Queue is clear</Text>
            <Text style={styles.emptyCopy}>All active orders have been completed.</Text>
          </View>
        }
        renderItem={({ item }) => <OrderCard order={item} busy={busyId === item.id} onAction={() => transition(item)} />}
      />
    </View>
  );
}

function OrderCard({ order, busy, onAction }: { order: KitchenOrder; busy: boolean; onAction: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const tone = statusTone(colors, order.status);
  const action = NEXT_ACTION[order.status];
  const paymentTone = paymentColors(colors, order.payment_status);

  return (
    <Pressable testID={`queue-order-${order.id}`} onPress={() => router.push(`/caterer/order/${order.id}`)} style={({ pressed }) => [styles.orderCard, pressed && styles.cardPressed]}>
      <View style={styles.orderTopRow}>
        <Text style={styles.orderId}>{order.id}</Text>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.statusPillText, { color: tone.fg }]}>{STATUS_LABEL[order.status] ?? order.status}</Text>
        </View>
      </View>
      <Text style={styles.orderItems}>{order.lines.map((line) => `${line.quantity}× ${line.name}`).join(", ")}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.orderMeta}>{formatTime(order.created_at)}{order.pickup_time ? ` · pickup ${order.pickup_time}` : ""}</Text>
        <View style={[styles.sourcePill, order.source === "offline" ? styles.sourceOffline : styles.sourceApp]}>
          <Text style={styles.sourceText}>{order.source === "offline" ? "OFFLINE" : "APP"}</Text>
        </View>
      </View>
      {(order.customer_name || order.customer_phone) && (
        <View style={styles.metaRow}>
          <Ionicons name="person-outline" size={13} color={colors.muted} />
          <Text style={styles.orderMeta}>{[order.customer_name, order.customer_phone].filter(Boolean).join(" · ")}</Text>
        </View>
      )}
      {!!order.notes && (
        <View style={styles.notesRow}>
          <Ionicons name="chatbox-ellipses-outline" size={13} color={colors.warning} />
          <Text style={styles.notesText} numberOfLines={1}>{order.notes}</Text>
        </View>
      )}
      <View style={styles.footerRow}>
        <View style={[styles.paymentPill, { backgroundColor: paymentTone.bg }]}>
          <Text style={[styles.paymentPillText, { color: paymentTone.fg }]}>{PAYMENT_LABEL[order.payment_method] ?? order.payment_method} · {paymentLabel(order.payment_status)}</Text>
        </View>
        <Text style={styles.orderAmount}>₹{order.amount}</Text>
      </View>
      {action && (
        <Pressable testID={`queue-action-${order.id}`} onPress={onAction} disabled={busy} style={({ pressed }) => [styles.actionButton, pressed && styles.cardPressed, busy && styles.actionBusy]}>
          <Ionicons name={action.icon as IconName} size={17} color={colors.onBrandPrimary} />
          <Text style={styles.actionText}>{busy ? "Updating..." : action.label}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function paymentLabel(status?: string): string {
  if (status === "paid") return "Paid";
  if (status === "pay_at_pickup") return "Pay at pickup";
  if (status === "unpaid") return "Unpaid";
  return "Pending";
}

function paymentColors(colors: ThemeColors, status?: string): { bg: string; fg: string } {
  if (status === "paid") return { bg: colors.brandTertiary, fg: colors.onBrandTertiary };
  if (status === "unpaid" || status === "pending") return { bg: colors.surfaceTertiary, fg: colors.error };
  return { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary };
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    header: { paddingHorizontal: 20, paddingBottom: 4 },
    eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 24, fontWeight: "800", marginTop: 4 },
    chipRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
    chip: { height: 36, flexShrink: 0, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.surfaceSecondary, justifyContent: "center" },
    chipActive: { backgroundColor: colors.brandPrimary },
    chipText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
    chipTextActive: { color: colors.onBrandPrimary },
    listContent: { paddingHorizontal: 20, paddingBottom: 28, gap: 12 },
    errorText: { color: colors.error, fontSize: 12, paddingHorizontal: 20 },
    emptyCard: { alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 30, gap: 6, marginTop: 8 },
    emptyTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
    emptyCopy: { color: colors.muted, fontSize: 12, textAlign: "center" },
    orderCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 14, gap: 8 },
    cardPressed: { opacity: 0.85 },
    orderTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    orderId: { color: colors.onSurface, fontSize: 15, fontWeight: "900" },
    statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    statusPillText: { fontSize: 11, fontWeight: "900" },
    orderItems: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    orderMeta: { color: colors.muted, fontSize: 12, flex: 1 },
    sourcePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    sourceApp: { backgroundColor: colors.surfaceTertiary },
    sourceOffline: { backgroundColor: colors.brandTertiary },
    sourceText: { color: colors.onSurfaceTertiary, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
    notesRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    notesText: { color: colors.onSurfaceSecondary, fontSize: 12, flex: 1, fontStyle: "italic" },
    footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    paymentPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    paymentPillText: { fontSize: 11, fontWeight: "800" },
    orderAmount: { color: colors.brandPrimary, fontSize: 16, fontWeight: "900" },
    actionButton: { minHeight: 44, borderRadius: 11, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 2 },
    actionBusy: { opacity: 0.6 },
    actionText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 13 },
  }),
);
