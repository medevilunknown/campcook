import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_BASE, MenuItem, post, request } from "@/src/api";
import { useCaterer } from "@/src/caterer";
import { makeStyles, useTheme } from "@/src/theme";

type FormState = { id: string | null; name: string; price: string; category: string; description: string; popular: boolean; available: boolean };

const EMPTY_FORM: FormState = { id: null, name: "", price: "", category: "Quick Bites", description: "", popular: false, available: true };

export default function MenuManageScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const { session } = useCaterer();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const value = await request<MenuItem[]>("/caterer/menu", {}, session.token);
      setItems(value);
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

  const categories = ["All", ...Array.from(new Set(items.map((item) => item.category)))];
  const filtered = items.filter((item) => (category === "All" || item.category === category) && item.name.toLowerCase().includes(search.toLowerCase()));

  const patch = async (path: string, body: unknown) => {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-session-token": session?.token ?? "" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail ?? "Update failed");
    return data;
  };

  const toggleAvailability = async (item: MenuItem & { available?: boolean }, value: boolean) => {
    try {
      await patch(`/caterer/menu/${item.id}`, { available: value });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveForm = async () => {
    const price = parseInt(form.price, 10);
    if (!form.name.trim() || !price || price <= 0) {
      setFormError("Add a dish name and a valid price.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (form.id) {
        await patch(`/caterer/menu/${form.id}`, { name: form.name.trim(), price, category: form.category, description: form.description.trim(), popular: form.popular, available: form.available });
      } else {
        await post("/caterer/menu", { name: form.name.trim(), price, category: form.category, description: form.description.trim(), popular: form.popular }, session?.token);
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CATALOG</Text>
        <Text style={styles.title}>Menu manager</Text>
      </View>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput testID="menu-search-input" value={search} onChangeText={setSearch} placeholder="Search dishes..." placeholderTextColor={colors.muted} style={styles.searchInput} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {categories.map((item) => (
          <Pressable key={item} testID={`menu-chip-${item.toLowerCase().replace(/\s+/g, "-")}`} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipActive]}>
            <Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {!!error && <Text testID="menu-error" style={styles.errorText}>{error}</Text>}
      <ScrollView
        testID="menu-list"
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} tintColor={colors.brandPrimary} />}
      >
        {filtered.map((item) => {
          const available = (item as MenuItem & { available?: boolean }).available !== false;
          return (
            <View key={item.id} testID={`dish-row-${item.id}`} style={styles.dishCard}>
              <View style={styles.dishMain}>
                <View style={styles.dishTitleRow}>
                  <Text style={styles.dishName}>{item.name}</Text>
                  {item.popular && (
                    <View style={styles.popularPill}>
                      <Text style={styles.popularText}>POPULAR</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.dishMeta}>{item.category}</Text>
                <Text style={styles.dishPrice}>₹{item.price}</Text>
              </View>
              <View style={styles.dishActions}>
                <Switch testID={`availability-switch-${item.id}`} value={available} onValueChange={(value) => toggleAvailability(item, value)} trackColor={{ false: colors.surfaceTertiary, true: colors.brandSecondary }} thumbColor={available ? colors.brandPrimary : colors.muted} />
                <Pressable testID={`edit-dish-${item.id}`} onPress={() => { setForm({ id: item.id, name: item.name, price: String(item.price), category: item.category, description: item.description, popular: item.popular, available }); setFormOpen(true); }} style={styles.editButton} hitSlop={6}>
                  <Ionicons name="create-outline" size={19} color={colors.brandPrimary} />
                </Pressable>
              </View>
            </View>
          );
        })}
        {!filtered.length && (
          <View style={styles.emptyCard}>
            <Ionicons name="restaurant-outline" size={32} color={colors.brandSecondary} />
            <Text style={styles.emptyTitle}>No dishes found</Text>
            <Text style={styles.emptyCopy}>Add your first dish with the button below.</Text>
          </View>
        )}
      </ScrollView>
      <Pressable testID="add-dish-fab" onPress={() => { setForm({ ...EMPTY_FORM }); setFormOpen(true); }} style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 76 }, pressed && styles.pressed]}>
        <Ionicons name="add" size={24} color={colors.onBrandPrimary} />
        <Text style={styles.fabText}>Add dish</Text>
      </Pressable>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.modalDismiss} onPress={() => setFormOpen(false)} />
          <View testID="dish-form-modal" style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            <Text style={styles.modalTitle}>{form?.id ? "Edit dish" : "Add new dish"}</Text>
            <TextInput testID="form-name-input" value={form?.name} onChangeText={(value) => setForm((current) => current && { ...current, name: value })} placeholder="Dish name" placeholderTextColor={colors.muted} style={styles.input} />
            <View style={styles.formRow}>
              <TextInput testID="form-price-input" value={form?.price} onChangeText={(value) => setForm((current) => current && { ...current, price: value.replace(/[^0-9]/g, "") })} placeholder="Price ₹" placeholderTextColor={colors.muted} style={[styles.input, styles.priceInput]} keyboardType="number-pad" />
              <TextInput testID="form-category-input" value={form?.category} onChangeText={(value) => setForm((current) => current && { ...current, category: value })} placeholder="Category" placeholderTextColor={colors.muted} style={[styles.input, styles.categoryInput]} />
            </View>
            <TextInput testID="form-description-input" value={form?.description} onChangeText={(value) => setForm((current) => current && { ...current, description: value })} placeholder="Short description" placeholderTextColor={colors.muted} style={[styles.input, styles.descriptionInput]} multiline />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Mark as popular</Text>
              <Switch testID="form-popular-switch" value={form?.popular} onValueChange={(value) => setForm((current) => current && { ...current, popular: value })} trackColor={{ false: colors.surfaceTertiary, true: colors.brandSecondary }} thumbColor={form?.popular ? colors.brandPrimary : colors.muted} />
            </View>
            {form?.id && (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Available today</Text>
                <Switch testID="form-available-switch" value={form.available} onValueChange={(value) => setForm((current) => current && { ...current, available: value })} trackColor={{ false: colors.surfaceTertiary, true: colors.brandSecondary }} thumbColor={form.available ? colors.brandPrimary : colors.muted} />
              </View>
            )}
            {!!formError && <Text testID="form-error" style={styles.errorText}>{formError}</Text>}
            <View style={styles.formButtons}>
              <Pressable testID="form-cancel-button" onPress={() => setFormOpen(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable testID="form-save-button" onPress={saveForm} disabled={saving} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
                <Text style={styles.saveText}>{saving ? "Saving..." : "Save dish"}</Text>
              </Pressable>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    header: { paddingHorizontal: 20, paddingBottom: 10 },
    eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 24, fontWeight: "800", marginTop: 4 },
    searchBox: { height: 46, borderRadius: 12, backgroundColor: colors.surfaceSecondary, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, marginHorizontal: 20 },
    searchInput: { flex: 1, color: colors.onSurface, fontSize: 14 },
    chipRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
    chip: { height: 36, flexShrink: 0, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.surfaceSecondary, justifyContent: "center" },
    chipActive: { backgroundColor: colors.brandPrimary },
    chipText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
    chipTextActive: { color: colors.onBrandPrimary },
    errorText: { color: colors.error, fontSize: 12, paddingHorizontal: 20 },
    listContent: { paddingHorizontal: 20, paddingBottom: 140, gap: 10 },
    dishCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
    dishMain: { flex: 1, gap: 3 },
    dishTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    dishName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    popularPill: { backgroundColor: colors.brandTertiary, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
    popularText: { color: colors.onBrandTertiary, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
    dishMeta: { color: colors.muted, fontSize: 12 },
    dishPrice: { color: colors.brandPrimary, fontSize: 15, fontWeight: "900" },
    dishActions: { alignItems: "center", gap: 8 },
    editButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
    emptyCard: { alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 30, gap: 6, marginTop: 10 },
    emptyTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
    emptyCopy: { color: colors.muted, fontSize: 12, textAlign: "center" },
    pressed: { opacity: 0.8 },
    fab: { position: "absolute", right: 20, minHeight: 50, borderRadius: 25, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, shadowColor: colors.surfaceInverse, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
    fabText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(17, 34, 24, 0.45)", justifyContent: "flex-end" },
    modalDismiss: { flex: 1 },
    modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, gap: 12, maxHeight: "88%" },
    modalTitle: { color: colors.onSurface, fontSize: 19, fontWeight: "800" },
    input: { minHeight: 48, borderRadius: 11, backgroundColor: colors.surfaceSecondary, paddingHorizontal: 14, color: colors.onSurface, fontSize: 14 },
    formRow: { flexDirection: "row", gap: 10 },
    priceInput: { width: 110 },
    categoryInput: { flex: 1 },
    descriptionInput: { minHeight: 70, textAlignVertical: "top", paddingTop: 13 },
    switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    switchLabel: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
    formButtons: { flexDirection: "row", gap: 10, marginTop: 4 },
    cancelButton: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    cancelText: { color: colors.onSurface, fontWeight: "800" },
    saveButton: { flex: 2, minHeight: 48, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
    saveText: { color: colors.onBrandPrimary, fontWeight: "800" },
  }),
);
