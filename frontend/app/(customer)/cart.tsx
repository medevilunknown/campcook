import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/store";
import { useTheme } from "@/src/theme";
import { iconFor, useStyles } from "@/src/ui";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { menu, cart, updateQuantity } = useApp();

  const items = menu.filter((item) => cart[item.id]);
  const total = items.reduce((sum, item) => sum + item.price * (cart[item.id] ?? 0), 0);

  return (
    <ScrollView testID="cart-screen" style={styles.root} contentContainerStyle={[styles.screenContent, { paddingTop: insets.top + 20 }]}>
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>Your cart</Text>
        <Text style={styles.sectionHint}>{items.length} items</Text>
      </View>
      {!items.length ? (
        <View style={styles.empty}>
          <Ionicons name="basket-outline" size={46} color={colors.brandSecondary} />
          <Text style={styles.emptyTitle}>Your tray is empty</Text>
          <Text style={styles.emptyCopy}>Add something fresh for your next break.</Text>
          <Pressable testID="browse-menu-button" onPress={() => router.push("/home")} style={styles.outlineButton}>
            <Text style={styles.outlineText}>Browse menu</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.cartList}>
            {items.map((item) => (
              <View key={item.id} testID={`cart-item-${item.id}`} style={styles.cartItem}>
                <View style={styles.smallFoodArt}>
                  <Ionicons name={iconFor(item)} size={24} color={colors.brandPrimary} />
                </View>
                <View style={styles.cartItemCopy}>
                  <Text style={styles.foodName}>{item.name}</Text>
                  <Text style={styles.foodCategory}>₹{item.price} each</Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable testID={`cart-minus-${item.id}`} onPress={() => updateQuantity(item, -1)} style={styles.stepButton}>
                    <Ionicons name="remove" size={16} color={colors.onSurface} />
                  </Pressable>
                  <Text testID={`cart-count-${item.id}`} style={styles.quantity}>{cart[item.id]}</Text>
                  <Pressable testID={`cart-plus-${item.id}`} onPress={() => updateQuantity(item, 1)} style={styles.stepButton}>
                    <Ionicons name="add" size={16} color={colors.onSurface} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.foodCategory}>Items total</Text>
              <Text style={styles.summaryValue}>₹{total}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.foodCategory}>Campus service fee</Text>
              <Text style={styles.summaryValue}>₹0</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total amount</Text>
              <Text testID="cart-total" style={styles.totalValue}>₹{total}</Text>
            </View>
          </View>
          <Pressable testID="checkout-button" onPress={() => router.push("/checkout")} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Continue to payment</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onBrandPrimary} />
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
