import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { request } from "@/src/api";
import { PAYMENT_LABEL, SalesSummary, useCaterer } from "@/src/caterer";
import { makeStyles, useTheme } from "@/src/theme";
import { IconName } from "@/src/ui";

export default function SalesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const { session } = useCaterer();
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const value = await request<SalesSummary>("/caterer/sales", {}, session.token);
      setSales(value);
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

  const payments = Object.entries(sales?.by_payment_method ?? {});
  const maxPayment = Math.max(1, ...payments.map(([, amount]) => amount));
  const sources = Object.entries(sales?.by_source ?? {});

  return (
    <ScrollView
      testID="sales-screen"
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} tintColor={colors.brandPrimary} />}
    >
      <View>
        <Text style={styles.eyebrow}>FINANCE</Text>
        <Text style={styles.title}>Sales summary</Text>
        <Text style={styles.subtitle}>{sales?.date ?? "Today"}</Text>
      </View>

      {!!error && <Text testID="sales-error" style={styles.errorText}>{error}</Text>}

      <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} style={styles.heroCard}>
        <View>
          <Text style={styles.heroLabel}>TOTAL REVENUE</Text>
          <Text testID="sales-total" style={styles.heroValue}>₹{sales?.total_revenue ?? 0}</Text>
          <Text style={styles.heroSub}>{sales?.order_count ?? 0} orders today</Text>
        </View>
        <Ionicons name="trending-up-outline" size={44} color={colors.brandTertiary} />
      </LinearGradient>

      <View style={styles.statsRow}>
        <MiniStat icon="checkmark-done-outline" label="Completed" value={sales?.completed_count ?? 0} />
        <MiniStat icon="time-outline" label="Active" value={sales?.active_count ?? 0} />
      </View>

      <Text style={styles.sectionTitle}>By payment method</Text>
      <View style={styles.card}>
        {!payments.length && <Text style={styles.emptyCopy}>No sales recorded yet today.</Text>}
        {payments.map(([method, amount]) => (
          <View key={method} testID={`sales-method-${method}`} style={styles.barRow}>
            <Text style={styles.barLabel}>{PAYMENT_LABEL[method] ?? method}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.max(6, (amount / maxPayment) * 100)}%` }]} />
            </View>
            <Text style={styles.barValue}>₹{amount}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>By order source</Text>
      <View style={styles.card}>
        {!sources.length && <Text style={styles.emptyCopy}>No orders yet.</Text>}
        {sources.map(([source, amount]) => (
          <View key={source} testID={`sales-source-${source}`} style={styles.sourceRow}>
            <Ionicons name={source === "offline" ? "storefront-outline" : "phone-portrait-outline"} size={18} color={colors.brandPrimary} />
            <Text style={styles.sourceLabel}>{source === "offline" ? "Offline counter bills" : "App orders"}</Text>
            <Text style={styles.barValue}>₹{amount}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Top dishes today</Text>
      <View style={styles.card}>
        {!sales?.top_items.length && <Text style={styles.emptyCopy}>No dishes sold yet.</Text>}
        {sales?.top_items.map((item, index) => (
          <View key={item.name} testID={`top-item-${index}`} style={styles.sourceRow}>
            <Text style={styles.rank}>{index + 1}</Text>
            <Text style={styles.sourceLabel}>{item.name}</Text>
            <Text style={styles.barValue}>{item.quantity} sold</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function MiniStat({ icon, label, value }: { icon: IconName; label: string; value: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.miniStat}>
      <Ionicons name={icon} size={17} color={colors.brandPrimary} />
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    content: { padding: 20, gap: 16, paddingBottom: 32 },
    eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 24, fontWeight: "800", marginTop: 4 },
    subtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
    errorText: { color: colors.error, fontSize: 12 },
    heroCard: { borderRadius: 20, padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    heroLabel: { color: colors.brandTertiary, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
    heroValue: { color: colors.onBrandPrimary, fontSize: 32, fontWeight: "900", marginTop: 6 },
    heroSub: { color: colors.onBrandPrimary, fontSize: 12, opacity: 0.85, marginTop: 4 },
    statsRow: { flexDirection: "row", gap: 10 },
    miniStat: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 12, gap: 3 },
    miniValue: { color: colors.onSurface, fontSize: 18, fontWeight: "900" },
    miniLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
    sectionTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800", marginTop: 4 },
    card: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16, gap: 12 },
    emptyCopy: { color: colors.muted, fontSize: 12 },
    barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    barLabel: { color: colors.onSurface, fontSize: 13, fontWeight: "700", width: 76 },
    barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
    barFill: { height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
    barValue: { color: colors.onSurface, fontSize: 13, fontWeight: "900", minWidth: 52, textAlign: "right" },
    sourceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    sourceLabel: { color: colors.onSurface, fontSize: 13, fontWeight: "700", flex: 1 },
    rank: { color: colors.brandPrimary, fontSize: 14, fontWeight: "900", width: 18 },
  }),
);
