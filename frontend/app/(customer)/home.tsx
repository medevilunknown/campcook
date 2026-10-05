import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MenuItem } from "@/src/api";
import { useApp } from "@/src/store";
import { ThemeColors, useTheme } from "@/src/theme";
import { categories, iconFor, useStyles } from "@/src/ui";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { menu, menuError, refreshMenu, cart, addToCart, updateQuantity, setSelected } = useApp();
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = menu.filter((item) => (category === "All" || item.category === category) && item.name.toLowerCase().includes(search.toLowerCase()));

  const openDetail = (item: MenuItem) => {
    setSelected(item);
    router.push("/detail");
  };

  const onRefresh = () => {
    setRefreshing(true);
    refreshMenu();
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <ScrollView
      testID="menu-screen"
      style={styles.root}
      contentContainerStyle={[styles.screenContent, { paddingTop: insets.top + 20 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
    >
      <View style={styles.homeHeader}>
        <View>
          <Text style={styles.eyebrow}>CAMPCOOK CANTEEN</Text>
          <Text style={styles.screenTitle}>What are you craving?</Text>
        </View>
        <Pressable testID="home-profile-button" onPress={() => router.push("/profile")} style={styles.avatar}>
          <Ionicons name="person" size={20} color={colors.brandPrimary} />
        </Pressable>
      </View>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput testID="menu-search-input" value={search} onChangeText={setSearch} placeholder="Search for dosa, rice, chai..." placeholderTextColor={colors.muted} style={styles.searchInput} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {categories.map((item) => (
          <Pressable key={item} testID={`category-chip-${item.toLowerCase().replace(/\s+/g, "-")}`} onPress={() => setCategory(item)} style={[styles.chip, { flexShrink: 0 }, category === item && styles.chipActive]}>
            <Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} style={styles.featureCard}>
        <View style={styles.featureCopy}>
          <Text style={styles.featureKicker}>TODAY&apos;S SPECIAL</Text>
          <Text style={styles.featureTitle}>Fresh plates,{"\n"}happy days.</Text>
          <Text style={styles.featureBody}>Made fresh for your lunch break.</Text>
        </View>
        <Ionicons name="leaf" size={80} color={colors.brandTertiary} />
      </LinearGradient>
      {!!menuError && <Text testID="menu-error" style={styles.errorText}>{menuError}</Text>}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Popular today</Text>
        <Text style={styles.sectionHint}>{filtered.length} dishes</Text>
      </View>
      <View style={styles.menuGrid}>
        {filtered.map((item) => {
          const count = cart[item.id] ?? 0;
          return (
            <Pressable key={item.id} testID={`dish-card-${item.id}`} onPress={() => openDetail(item)} style={({ pressed }) => [styles.foodCard, pressed && styles.cardPressed]}>
              <View style={[styles.foodArt, { backgroundColor: colors[item.accent as keyof ThemeColors] ?? colors.brandTertiary }]}>
                <Ionicons name={iconFor(item)} size={42} color={colors.brandPrimary} />
                <View style={styles.cardAction}>
                  {count > 0 && (
                    <Pressable testID={`dish-minus-${item.id}`} onPress={() => updateQuantity(item, -1)} style={({ pressed }) => [styles.countButton, pressed && styles.pressed]} hitSlop={6}>
                      <Ionicons name="remove" size={15} color={colors.brandPrimary} />
                    </Pressable>
                  )}
                  {count > 0 && (
                    <Text testID={`dish-count-${item.id}`} style={styles.cardCount}>{count}</Text>
                  )}
                  <Pressable testID={`add-dish-${item.id}`} onPress={() => addToCart(item)} style={({ pressed }) => [styles.addMiniButton, pressed && styles.pressed]} hitSlop={6}>
                    <Ionicons name="add" size={18} color={colors.onBrandPrimary} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.foodName}>{item.name}</Text>
              <Text style={styles.foodCategory}>{item.category}</Text>
              <Text style={styles.foodPrice}>₹{item.price}</Text>
            </Pressable>
          );
        })}
      </View>
      {!filtered.length && (
        <View style={styles.empty}>
          <Ionicons name="leaf-outline" size={36} color={colors.brandSecondary} />
          <Text style={styles.emptyTitle}>No dishes found</Text>
          <Text style={styles.emptyCopy}>Try another category or search term.</Text>
        </View>
      )}
    </ScrollView>
  );
}
