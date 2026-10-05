import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { request } from "@/src/api";
import { formatTime, KitchenOrder, SalesSummary, STATUS_LABEL, statusTone, useCaterer } from "@/src/caterer";
import { makeStyles, useTheme } from "@/src/theme";
import { IconName } from "@/src/ui";

export default function CatererDashboard() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { session, signOut } = useCaterer();
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [salesData, ordersData] = await Promise.all([
        request<SalesSummary>("/caterer/sales", {}, session.token),
        request<KitchenOrder[]>("/caterer/orders?status=active", {}, session.token),
      ]);
      setSales(salesData);
      setOrders(ordersData);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = sales?.status_counts ?? {};
  const preparing = (counts.accepted ?? 0) + (counts.preparing ?? 0);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/caterer/login");
  };

  return (
    <ScrollView
      testID="caterer-dashboard"
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} tintColor={colors.brandPrimary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>KITCHEN WORKSPACE</Text>
          <Text style={styles.title}>Today at a glance</Text>
          <Text style={styles.subtitle}>{session?.user.name ?? "Caterer"} · {sales?.date ?? ""}</Text>
        </View>
        <Pressable testID="caterer-signout-button" onPress={handleSignOut} style={styles.signOutButton} hitSlop={8}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
        </Pressable>
      </View>

      {!!error && <Text testID="dashboard-error" style={styles.errorText}>{error}</Text>}

      <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} style={styles.heroCard}>
        <View>
          <Text style={styles.heroLabel}>TODAY&apos;S EARNINGS</Text>
          <Text testID="dashboard-earnings" style={styles.heroValue}>₹{sales?.total_revenue ?? 0}</Text>
          <Text style={styles.heroSub}>{sales?.order_count ?? 0} orders · {sales?.completed_count ?? 0} completed</Text>
        </View>
        <Ionicons name="wallet-outline" size={44} color={colors.brandTertiary} />
      </LinearGradient>

      <View style={styles.statsRow}>
        <StatChip icon="flash-outline" label="New" value={counts.placed ?? 0} />
        <StatChip icon="flame-outline" label="Preparing" value={preparing} />
        <StatChip icon="bag-check-outline" label="Ready" value={counts.ready ?? 0} />
      </View>

      <Pressable testID="new-offline-bill-button" onPress={() => router.push("/caterer/new-order")} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Ionicons name="add-circle-outline" size={20} color={colors.onBrandPrimary} />
        <Text style={styles.primaryButtonText}>New offline bill</Text>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Live queue</Text>
        <Pressable testID="open-queue-button" onPress={() => router.push("/caterer/queue")} hitSlop={8}>
          <Text style={styles.sectionLink}>Open queue</Text>
        </Pressable>
      </View>

      {!orders.length && !error && (
        <View style={styles.emptyCard}>
          <Ionicons name="leaf-outline" size={30} color={colors.brandSecondary} />
          <Text style={styles.emptyTitle}>Queue is clear</Text>
          <Text style={styles.emptyCopy}>New orders will appear here the moment they arrive.</Text>
        </View>
      )}

      {orders.slice(0, 5).map((order) => {
        const tone = statusTone(colors, order.status);
        return (
          <Pressable key={order.id} testID={`dashboard-order-${order.id}`} onPress={() => router.push(`/caterer/order/${order.id}`)} style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}>
            <View style={styles.orderMain}>
              <Text style={styles.orderId}>{order.id}</Text>
              <Text style={styles.orderMeta}>{order.lines.map((line) => `${line.quantity}× ${line.name}`).join(", ")}</Text>
              <Text style={styles.orderMeta}>{formatTime(order.created_at)} · ₹{order.amount}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
              <Text style={[styles.statusPillText, { color: tone.fg }]}>{STATUS_LABEL[order.status] ?? order.status}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function StatChip({ icon, label, value }: { icon: IconName; label: string; value: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon} size={16} color={colors.brandPrimary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    content: { padding: 20, gap: 16, paddingBottom: 32 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 24, fontWeight: "800", marginTop: 4 },
    subtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
    signOutButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
    errorText: { color: colors.error, fontSize: 12 },
    heroCard: { borderRadius: 20, padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    heroLabel: { color: colors.brandTertiary, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
    heroValue: { color: colors.onBrandPrimary, fontSize: 32, fontWeight: "900", marginTop: 6 },
    heroSub: { color: colors.onBrandPrimary, fontSize: 12, opacity: 0.85, marginTop: 4 },
    statsRow: { flexDirection: "row", gap: 10 },
    statChip: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 12, gap: 3 },
    statValue: { color: colors.onSurface, fontSize: 18, fontWeight: "900" },
    statLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
    primaryButton: { minHeight: 50, borderRadius: 12, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    primaryButtonText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 },
    pressed: { opacity: 0.8 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
    sectionTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
    sectionLink: { color: colors.brandPrimary, fontSize: 13, fontWeight: "800" },
    emptyCard: { alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 26, gap: 6 },
    emptyTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
    emptyCopy: { color: colors.muted, fontSize: 12, textAlign: "center" },
    orderCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
    orderMain: { flex: 1, gap: 2 },
    orderId: { color: colors.onSurface, fontSize: 14, fontWeight: "900" },
    orderMeta: { color: colors.muted, fontSize: 12 },
    statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    statusPillText: { fontSize: 11, fontWeight: "900" },
  }),
);
