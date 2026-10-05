import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/store";
import { useTheme } from "@/src/theme";
import { iconFor, useStyles } from "@/src/ui";

export default function DetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { selected, addToCart } = useApp();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  if (!selected) return <Redirect href="/home" />;
  const item = selected;

  const add = () => {
    addToCart(item, quantity);
    router.push("/cart");
  };

  return (
    <ScrollView testID="detail-screen" style={styles.root} contentContainerStyle={[styles.screenContent, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Pressable testID="detail-back-button" onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
      </Pressable>
      <LinearGradient colors={[colors.brandTertiary, colors.surfaceSecondary]} style={styles.detailArt}>
        <Ionicons name={iconFor(item)} size={92} color={colors.brandPrimary} />
      </LinearGradient>
      <View style={styles.detailTitleRow}>
        <View>
          <Text style={styles.screenTitle}>{item.name}</Text>
          <Text style={styles.foodCategory}>{item.category} · Fresh today</Text>
        </View>
        <Text style={styles.detailPrice}>₹{item.price}</Text>
      </View>
      <Text style={styles.detailDescription}>{item.description}</Text>
      <Text style={styles.optionTitle}>Special instructions</Text>
      <TextInput testID="detail-note-input" value={note} onChangeText={setNote} placeholder="Less spicy, no onion..." placeholderTextColor={colors.muted} style={[styles.input, styles.noteInput, { backgroundColor: colors.surfaceSecondary }]} />
      <View style={styles.quantityRow}>
        <Text style={styles.optionTitle}>Quantity</Text>
        <View style={styles.stepper}>
          <Pressable testID="detail-minus-button" onPress={() => setQuantity(Math.max(1, quantity - 1))} style={styles.stepButton}>
            <Ionicons name="remove" size={18} color={colors.onSurface} />
          </Pressable>
          <Text testID="detail-quantity" style={styles.quantity}>{quantity}</Text>
          <Pressable testID="detail-plus-button" onPress={() => setQuantity(quantity + 1)} style={styles.stepButton}>
            <Ionicons name="add" size={18} color={colors.onSurface} />
          </Pressable>
        </View>
      </View>
      <Pressable testID="detail-add-button" onPress={add} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>Add to cart · ₹{item.price * quantity}</Text>
      </Pressable>
    </ScrollView>
  );
}
