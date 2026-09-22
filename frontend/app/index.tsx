import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MenuItem, Order, getSession, post, request, SESSION_KEY } from "@/src/api";
import { makeStyles, ThemeColors, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

type Screen = "home" | "detail" | "cart" | "checkout" | "orders" | "profile";
type IconName = keyof typeof Ionicons.glyphMap;

const categories = ["All", "South Indian", "North Indian", "Quick Bites", "Beverages"];
const iconFor = (item: MenuItem): IconName => (item.icon in Ionicons.glyphMap ? item.icon : "restaurant-outline") as IconName;

export default function Index() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const [session, setSession] = useState<{ token: string; user: Record<string, string | number> } | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [screen, setScreen] = useState<Screen>("home");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getSession().then((value) => {
      setSession(value);
      setLoadingSession(false);
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    request<MenuItem[]>("/menu", {}, session.token).then(setMenu).catch((e: Error) => setError(e.message));
  }, [session]);

  const cartItems = useMemo(() => menu.filter((item) => cart[item.id]), [cart, menu]);
  const cartTotal = cartItems.reduce((total, item) => total + item.price * (cart[item.id] ?? 0), 0);
  const cartCount = Object.values(cart).reduce((total, count) => total + count, 0);

  const addToCart = (item: MenuItem, quantity = 1) => setCart((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + quantity }));
  const updateQuantity = (item: MenuItem, delta: number) => setCart((current) => {
    const next = Math.max(0, (current[item.id] ?? 0) + delta);
    const updated = { ...current };
    if (next === 0) delete updated[item.id]; else updated[item.id] = next;
    return updated;
  });
  const openDetail = (item: MenuItem) => { setSelected(item); setScreen("detail"); };
  const signOut = async () => { await storage.secureRemove(SESSION_KEY); setSession(null); setCart({}); setScreen("home"); };

  if (loadingSession) return <View style={[styles.root, styles.center]}><ActivityIndicator color={colors.brandPrimary} /></View>;
  if (!session) return <AuthScreen onSignedIn={setSession} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {screen === "home" && <HomeScreen menu={menu} error={error} onSelect={openDetail} onAdd={addToCart} />}
      {screen === "detail" && selected && <DetailScreen item={selected} onBack={() => setScreen("home")} onAdd={(count) => { addToCart(selected, count); setScreen("cart"); }} />}
      {screen === "cart" && <CartScreen items={cartItems} cart={cart} total={cartTotal} onBack={() => setScreen("home")} onChange={updateQuantity} onCheckout={() => setScreen("checkout")} onBrowse={() => setScreen("home")} />}
      {screen === "checkout" && <CheckoutScreen session={session} items={cartItems} cart={cart} total={cartTotal} onBack={() => setScreen("cart")} onPlaced={(order) => { setActiveOrder(order); setCart({}); setScreen("orders"); }} />}
      {screen === "orders" && <OrdersScreen session={session} activeOrder={activeOrder} onBack={() => setScreen("home")} onOrderLoaded={setActiveOrder} />}
      {screen === "profile" && <ProfileScreen user={session.user} onSignOut={signOut} />}
      <BottomNav screen={screen} count={cartCount} onNavigate={(next) => setScreen(next)} bottomInset={insets.bottom} />
    </View>
  );
}

function AuthScreen({ onSignedIn }: { onSignedIn: (session: { token: string; user: Record<string, string | number> }) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [role, setRole] = useState<"student" | "staff">("student");
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const signIn = async () => {
    if (!identifier.trim()) return setMessage("Enter your student/staff ID or email.");
    setBusy(true); setMessage("");
    try {
      const result = await post<{ token: string; user: Record<string, string | number> }>("/auth/login", { identifier, role, phone_number: phone || undefined });
      await storage.secureSet(SESSION_KEY, result);
      onSignedIn(result);
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  const sendOtp = async () => {
    if (!phone.trim()) return setMessage("Add a phone number in international format first.");
    setBusy(true); setMessage("");
    try { await post("/twilio/otp/send", { phone_number: phone }); setOtpSent(true); setMessage("Code sent. Check your phone."); }
    catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  const google = async () => {
    try { const result = await request<{ available: boolean; message?: string }>("/auth/google"); setMessage(result.available ? "Open the managed Google sign-in from your project callback." : result.message ?? "Google sign-in is not configured yet."); }
    catch (e) { setMessage((e as Error).message); }
  };
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView testID="welcome-screen" contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoMark}><Ionicons name="restaurant-outline" size={34} color={colors.onBrandPrimary} /></View>
        <Text style={styles.eyebrow}>CAMPCOOK CANTEEN</Text>
        <Text style={styles.heroTitle}>Good Food,{"\n"}Brighter Days.</Text>
        <Text style={styles.heroCopy}>Quick, fresh and delicious meals for your campus day.</Text>
        <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} style={styles.authCard}>
          <Text style={styles.cardLabel}>Welcome back</Text>
          <View style={styles.roleSwitch}>
            {(["student", "staff"] as const).map((value) => <Pressable key={value} onPress={() => setRole(value)} style={[styles.roleButton, role === value && styles.roleButtonActive]}><Text style={[styles.roleText, role === value && styles.roleTextActive]}>{value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}
          </View>
          <TextInput value={identifier} onChangeText={setIdentifier} placeholder={role === "student" ? "Student ID or email" : "Staff ID or email"} placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" />
          <View style={styles.phoneRow}><TextInput value={phone} onChangeText={setPhone} placeholder="Phone for SMS updates" placeholderTextColor={colors.muted} style={[styles.input, styles.phoneInput]} keyboardType="phone-pad" /><Pressable onPress={sendOtp} style={({ pressed }) => [styles.otpButton, pressed && styles.pressed]}><Text style={styles.otpText}>{otpSent ? "Resend" : "Send code"}</Text></Pressable></View>
          {otpSent && <TextInput value={otp} onChangeText={setOtp} placeholder="Enter SMS code" placeholderTextColor={colors.muted} style={styles.input} keyboardType="number-pad" />}
          {!!message && <Text style={styles.formMessage}>{message}</Text>}
          <Pressable onPress={signIn} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} disabled={busy}><Text style={styles.primaryButtonText}>{busy ? "Please wait..." : "Continue to campcook"}</Text></Pressable>
          <View style={styles.orLine}><View style={styles.line} /><Text style={styles.orText}>or continue with</Text><View style={styles.line} /></View>
          <Pressable onPress={google} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}><Ionicons name="logo-google" size={18} color={colors.error} /><Text style={styles.googleText}>Continue with Google</Text></Pressable>
        </LinearGradient>
        <Text style={styles.privacy}>By continuing, you agree to your campus dining terms.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HomeScreen({ menu, error, onSelect, onAdd }: { menu: MenuItem[]; error: string; onSelect: (item: MenuItem) => void; onAdd: (item: MenuItem) => void }) {
  const { colors } = useTheme(); const styles = useStyles();
  const [category, setCategory] = useState("All"); const [search, setSearch] = useState("");
  const filtered = menu.filter((item) => (category === "All" || item.category === category) && item.name.toLowerCase().includes(search.toLowerCase()));
  return <ScrollView testID="menu-screen" contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
    <View style={styles.homeHeader}><View><Text style={styles.eyebrow}>MONDAY, 24 JUNE</Text><Text style={styles.screenTitle}>What are you craving?</Text></View><View style={styles.avatar}><Ionicons name="person" size={20} color={colors.brandPrimary} /></View></View>
    <View style={styles.searchBox}><Ionicons name="search" size={18} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search for dosa, rice, chai..." placeholderTextColor={colors.muted} style={styles.searchInput} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipActive]}><Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</ScrollView>
    <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} style={styles.featureCard}><View style={styles.featureCopy}><Text style={styles.featureKicker}>TODAY&apos;S SPECIAL</Text><Text style={styles.featureTitle}>Fresh plates,{"\n"}happy days.</Text><Text style={styles.featureBody}>Made fresh for your lunch break.</Text></View><Ionicons name="leaf" size={80} color={colors.brandTertiary} /></LinearGradient>
    {!!error && <Text style={styles.errorText}>{error}</Text>}
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Popular today</Text><Text style={styles.sectionHint}>{filtered.length} dishes</Text></View>
    <View style={styles.menuGrid}>{filtered.map((item) => <Pressable key={item.id} onPress={() => onSelect(item)} style={({ pressed }) => [styles.foodCard, pressed && styles.cardPressed]}><View style={[styles.foodArt, { backgroundColor: colors[item.accent as keyof ThemeColors] ?? colors.brandTertiary }]}><Ionicons name={iconFor(item)} size={42} color={colors.brandPrimary} /><Pressable onPress={() => onAdd(item)} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><Ionicons name="add" size={20} color={colors.onBrandPrimary} /></Pressable></View><Text style={styles.foodName}>{item.name}</Text><Text style={styles.foodCategory}>{item.category}</Text><Text style={styles.foodPrice}>₹{item.price}</Text></Pressable>)}</View>
    {!filtered.length && <View style={styles.empty}><Ionicons name="leaf-outline" size={36} color={colors.brandSecondary} /><Text style={styles.emptyTitle}>No dishes found</Text><Text style={styles.emptyCopy}>Try another category or search term.</Text></View>}
  </ScrollView>;
}

function DetailScreen({ item, onBack, onAdd }: { item: MenuItem; onBack: () => void; onAdd: (quantity: number) => void }) {
  const { colors } = useTheme(); const styles = useStyles(); const [quantity, setQuantity] = useState(1); const [note, setNote] = useState("");
  return <ScrollView testID="detail-screen" contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
    <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
    <LinearGradient colors={[colors.brandTertiary, colors.surfaceSecondary]} style={styles.detailArt}><Ionicons name={iconFor(item)} size={92} color={colors.brandPrimary} /></LinearGradient>
    <View style={styles.detailTitleRow}><View><Text style={styles.screenTitle}>{item.name}</Text><Text style={styles.foodCategory}>{item.category} · Fresh today</Text></View><Text style={styles.detailPrice}>₹{item.price}</Text></View>
    <Text style={styles.detailDescription}>{item.description}</Text>
    <Text style={styles.optionTitle}>Special instructions</Text><TextInput value={note} onChangeText={setNote} placeholder="Less spicy, no onion..." placeholderTextColor={colors.muted} style={[styles.input, styles.noteInput]} />
    <View style={styles.quantityRow}><Text style={styles.optionTitle}>Quantity</Text><View style={styles.stepper}><Pressable onPress={() => setQuantity(Math.max(1, quantity - 1))} style={styles.stepButton}><Ionicons name="remove" size={18} color={colors.onSurface} /></Pressable><Text style={styles.quantity}>{quantity}</Text><Pressable onPress={() => setQuantity(quantity + 1)} style={styles.stepButton}><Ionicons name="add" size={18} color={colors.onSurface} /></Pressable></View></View>
    <Pressable onPress={() => onAdd(quantity)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Add to cart · ₹{item.price * quantity}</Text></Pressable>
  </ScrollView>;
}

function CartScreen({ items, cart, total, onBack, onChange, onCheckout, onBrowse }: { items: MenuItem[]; cart: Record<string, number>; total: number; onBack: () => void; onChange: (item: MenuItem, delta: number) => void; onCheckout: () => void; onBrowse: () => void }) {
  const { colors } = useTheme(); const styles = useStyles();
  return <ScrollView testID="cart-screen" contentContainerStyle={styles.screenContent}><View style={styles.titleRow}><Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable><Text style={styles.screenTitle}>Your cart</Text><Text style={styles.sectionHint}>{items.length} items</Text></View>{!items.length ? <View style={styles.empty}><Ionicons name="basket-outline" size={46} color={colors.brandSecondary} /><Text style={styles.emptyTitle}>Your tray is empty</Text><Text style={styles.emptyCopy}>Add something fresh for your next break.</Text><Pressable onPress={onBrowse} style={styles.outlineButton}><Text style={styles.outlineText}>Browse menu</Text></Pressable></View> : <><View style={styles.cartList}>{items.map((item) => <View key={item.id} style={styles.cartItem}><View style={styles.smallFoodArt}><Ionicons name={iconFor(item)} size={24} color={colors.brandPrimary} /></View><View style={styles.cartItemCopy}><Text style={styles.foodName}>{item.name}</Text><Text style={styles.foodCategory}>₹{item.price} each</Text></View><View style={styles.stepper}><Pressable onPress={() => onChange(item, -1)} style={styles.stepButton}><Ionicons name="remove" size={16} color={colors.onSurface} /></Pressable><Text style={styles.quantity}>{cart[item.id]}</Text><Pressable onPress={() => onChange(item, 1)} style={styles.stepButton}><Ionicons name="add" size={16} color={colors.onSurface} /></Pressable></View></View>)}</View><View style={styles.summary}><View style={styles.summaryRow}><Text style={styles.foodCategory}>Items total</Text><Text style={styles.summaryValue}>₹{total}</Text></View><View style={styles.summaryRow}><Text style={styles.foodCategory}>Campus service fee</Text><Text style={styles.summaryValue}>₹0</Text></View><View style={styles.divider} /><View style={styles.summaryRow}><Text style={styles.totalLabel}>Total amount</Text><Text style={styles.totalValue}>₹{total}</Text></View></View><Pressable onPress={onCheckout} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Continue to payment</Text><Ionicons name="arrow-forward" size={18} color={colors.onBrandPrimary} /></Pressable></>}</ScrollView>;
}

function CheckoutScreen({ session, items, cart, total, onBack, onPlaced }: { session: { token: string }; items: MenuItem[]; cart: Record<string, number>; total: number; onBack: () => void; onPlaced: (order: Order) => void }) {
  const { colors } = useTheme(); const styles = useStyles(); const [method, setMethod] = useState<"razorpay" | "cash">("razorpay"); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const placeOrder = async () => {
    setBusy(true); setMessage(""); const body = { items: items.map((item) => ({ item_id: item.id, quantity: cart[item.id] })), payment_method: method };
    try {
      if (method === "cash") { const order = await post<Order>("/orders", body, session.token); onPlaced(order); return; }
      const payment = await post<{ order_id: string; razorpay_order_id: string; amount: number; currency: string; key_id: string }>("/payments/razorpay/order", body, session.token);
      if (Platform.OS === "web") throw new Error("Razorpay checkout needs the Android or iOS app build.");
      const RazorpayCheckout = (await import("react-native-razorpay")).default;
      const result = await RazorpayCheckout.open({ key: payment.key_id, amount: payment.amount, currency: payment.currency, name: "campcook", description: "Campus canteen order", order_id: payment.razorpay_order_id, theme: { color: colors.brandPrimary } });
      await post("/payments/razorpay/verify", result, session.token);
      onPlaced({ id: payment.order_id, amount: total, payment_method: "razorpay", status: "placed", created_at: new Date().toISOString(), lines: items.map((item) => ({ name: item.name, quantity: cart[item.id], unit_price: item.price })) });
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  return <ScrollView testID="checkout-screen" contentContainerStyle={styles.screenContent}><View style={styles.titleRow}><Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable><Text style={styles.screenTitle}>Payment method</Text></View><Text style={styles.sectionTitle}>Choose how to pay</Text><View style={styles.paymentList}><PaymentOption icon="card-outline" title="Razorpay" subtitle="UPI, cards, wallets and net banking" selected={method === "razorpay"} onPress={() => setMethod("razorpay")} /><PaymentOption icon="cash-outline" title="Cash at counter" subtitle="Pay when you collect your order" selected={method === "cash"} onPress={() => setMethod("cash")} /></View><View style={styles.summary}><View style={styles.summaryRow}><Text style={styles.foodCategory}>Bill summary</Text><Text style={styles.foodCategory}>{items.length} dishes</Text></View><View style={styles.summaryRow}><Text style={styles.totalLabel}>Total amount</Text><Text style={styles.totalValue}>₹{total}</Text></View></View>{!!message && <Text style={styles.errorText}>{message}</Text>}<Pressable onPress={placeOrder} disabled={busy} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{busy ? "Processing..." : method === "cash" ? "Place order" : `Pay ₹${total} securely`}</Text></Pressable><Text style={styles.secureNote}><Ionicons name="shield-checkmark-outline" size={15} color={colors.brandPrimary} /> Your payment is protected by Razorpay.</Text></ScrollView>;
}

function PaymentOption({ icon, title, subtitle, selected, onPress }: { icon: IconName; title: string; subtitle: string; selected: boolean; onPress: () => void }) { const { colors } = useTheme(); const styles = useStyles(); return <Pressable onPress={onPress} style={[styles.paymentOption, selected && styles.paymentSelected]}><Ionicons name={icon} size={25} color={selected ? colors.brandPrimary : colors.muted} /><View style={styles.paymentCopy}><Text style={styles.foodName}>{title}</Text><Text style={styles.foodCategory}>{subtitle}</Text></View><Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={selected ? colors.brandPrimary : colors.borderStrong} /></Pressable>; }

function OrdersScreen({ session, activeOrder, onBack, onOrderLoaded }: { session: { token: string }; activeOrder: Order | null; onBack: () => void; onOrderLoaded: (order: Order | null) => void }) { const { colors } = useTheme(); const styles = useStyles(); const [orders, setOrders] = useState<Order[]>([]); useEffect(() => { request<Order[]>("/orders", {}, session.token).then((value) => { setOrders(value); if (!activeOrder && value[0]) onOrderLoaded(value[0]); }).catch(() => undefined); }, [session.token, activeOrder, onOrderLoaded]); const order = activeOrder ?? orders[0]; return <ScrollView testID="orders-screen" contentContainerStyle={styles.screenContent}><View style={styles.titleRow}><Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable><Text style={styles.screenTitle}>Order status</Text></View>{order ? <><View style={styles.statusCard}><Ionicons name="checkmark-circle" size={58} color={colors.brandPrimary} /><Text style={styles.screenTitle}>{order.status === "payment_pending" ? "Payment pending" : "Order placed!"}</Text><Text style={styles.detailDescription}>Your food is being prepared with care.</Text><Text style={styles.orderNumber}>{order.id}</Text></View><View style={styles.timeline}>{["Order placed", "Preparing your order", "Ready for pickup", "Completed"].map((step, index) => <View key={step} style={styles.timelineRow}><View style={[styles.timelineDot, index < 2 && styles.timelineDotActive]}><Ionicons name={index < 2 ? "checkmark" : "ellipse-outline"} size={12} color={index < 2 ? colors.onBrandPrimary : colors.muted} /></View><View><Text style={styles.foodName}>{step}</Text><Text style={styles.foodCategory}>{index === 0 ? "Just now" : index === 1 ? "Kitchen is on it" : "We will notify you"}</Text></View></View>)}</View><View style={styles.noticeCard}><Ionicons name="notifications-outline" size={22} color={colors.brandPrimary} /><Text style={styles.foodCategory}>SMS and WhatsApp updates will follow when Twilio credentials are connected.</Text></View></> : <View style={styles.empty}><Ionicons name="receipt-outline" size={44} color={colors.brandSecondary} /><Text style={styles.emptyTitle}>No active orders</Text><Text style={styles.emptyCopy}>Your next delicious order will show up here.</Text></View>}</ScrollView>; }

function ProfileScreen({ user, onSignOut }: { user: Record<string, string | number>; onSignOut: () => void }) { const { colors } = useTheme(); const styles = useStyles(); return <ScrollView testID="profile-screen" contentContainerStyle={styles.screenContent}><View style={styles.profileHeader}><View style={styles.profileAvatar}><Ionicons name="person" size={34} color={colors.brandPrimary} /></View><Text style={styles.screenTitle}>{String(user.name ?? "Campus guest")}</Text><Text style={styles.foodCategory}>{String(user.role ?? "student")} · {String(user.identifier ?? "")}</Text></View><View style={styles.balanceCard}><View><Text style={styles.cardLabel}>CAMPUS WALLET</Text><Text style={styles.balance}>₹{String(user.meal_balance ?? 250)}</Text><Text style={styles.foodCategory}>Available meal balance</Text></View><Ionicons name="wallet-outline" size={38} color={colors.brandPrimary} /></View>{["My orders", "Pickup preferences", "Payment methods", "Help & support"].map((item) => <Pressable key={item} style={styles.profileRow}><Ionicons name={item === "My orders" ? "receipt-outline" : item === "Help & support" ? "help-circle-outline" : "settings-outline"} size={21} color={colors.brandPrimary} /><Text style={styles.profileRowText}>{item}</Text><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>)}<View style={styles.twilioCard}><View style={styles.twilioIcon}><Ionicons name="chatbubbles-outline" size={22} color={colors.onBrandTertiary} /></View><View style={styles.paymentCopy}><Text style={styles.foodName}>Order notifications</Text><Text style={styles.foodCategory}>SMS + WhatsApp via Twilio</Text></View><Text style={styles.pendingPill}>READY</Text></View><Pressable onPress={onSignOut} style={styles.signOut}><Ionicons name="log-out-outline" size={20} color={colors.error} /><Text style={styles.signOutText}>Sign out</Text></Pressable></ScrollView>; }

function BottomNav({ screen, count, onNavigate, bottomInset }: { screen: Screen; count: number; onNavigate: (screen: Screen) => void; bottomInset: number }) { const { colors } = useTheme(); const styles = useStyles(); const items: { key: Screen; label: string; icon: IconName }[] = [{ key: "home", label: "Home", icon: "home-outline" }, { key: "orders", label: "Orders", icon: "receipt-outline" }, { key: "cart", label: "Cart", icon: "basket-outline" }, { key: "profile", label: "Profile", icon: "person-outline" }]; return <View style={[styles.bottomNav, { paddingBottom: Math.max(bottomInset, 10) }]}>{items.map((item) => <Pressable key={item.key} onPress={() => onNavigate(item.key)} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}><View><Ionicons name={screen === item.key ? item.icon.replace("-outline", "") as IconName : item.icon} size={22} color={screen === item.key ? colors.brandPrimary : colors.muted} />{item.key === "cart" && count > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{count}</Text></View>}</View><Text style={[styles.navLabel, screen === item.key && styles.navLabelActive]}>{item.label}</Text></Pressable>)}</View>; }

const useStyles = makeStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface }, center: { alignItems: "center", justifyContent: "center" }, screenContent: { padding: 20, paddingBottom: 30, gap: 18 }, authContent: { flexGrow: 1, padding: 24, justifyContent: "center", backgroundColor: colors.surface }, logoMark: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: 20 }, eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }, heroTitle: { color: colors.onSurface, fontSize: 34, lineHeight: 39, fontWeight: "800", marginTop: 8 }, heroCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 24 }, authCard: { borderRadius: 22, padding: 18, gap: 12 }, cardLabel: { color: colors.onBrandPrimary, fontSize: 13, fontWeight: "800", letterSpacing: 1 }, roleSwitch: { flexDirection: "row", backgroundColor: colors.brandSecondary, borderRadius: 10, padding: 3 }, roleButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 8 }, roleButtonActive: { backgroundColor: colors.surface }, roleText: { color: colors.onBrandPrimary, fontWeight: "700" }, roleTextActive: { color: colors.brandPrimary }, input: { minHeight: 48, borderRadius: 11, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.onSurface, fontSize: 14 }, phoneRow: { flexDirection: "row", gap: 8 }, phoneInput: { flex: 1 }, otpButton: { minHeight: 48, paddingHorizontal: 12, borderRadius: 11, backgroundColor: colors.brandTertiary, justifyContent: "center" }, otpText: { color: colors.onBrandTertiary, fontSize: 12, fontWeight: "800" }, formMessage: { color: colors.onBrandPrimary, fontSize: 12, lineHeight: 17 }, primaryButton: { minHeight: 50, borderRadius: 12, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18 }, primaryButtonText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 }, pressed: { opacity: 0.78 }, orLine: { flexDirection: "row", alignItems: "center", gap: 8 }, line: { flex: 1, height: 1, backgroundColor: colors.brandSecondary }, orText: { color: colors.onBrandPrimary, fontSize: 11 }, googleButton: { minHeight: 46, borderRadius: 11, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, googleText: { color: colors.onSurface, fontSize: 14, fontWeight: "700" }, privacy: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 18 }, homeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, screenTitle: { color: colors.onSurface, fontSize: 24, fontWeight: "800" }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }, searchBox: { height: 48, borderRadius: 12, backgroundColor: colors.surfaceSecondary, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14 }, searchInput: { flex: 1, color: colors.onSurface, fontSize: 14 }, chips: { gap: 8, paddingVertical: 2 }, chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.surfaceSecondary, justifyContent: "center" }, chipActive: { backgroundColor: colors.brandPrimary }, chipText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" }, chipTextActive: { color: colors.onBrandPrimary }, featureCard: { borderRadius: 20, minHeight: 152, padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center", overflow: "hidden" }, featureCopy: { gap: 6 }, featureKicker: { color: colors.brandTertiary, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, featureTitle: { color: colors.onBrandPrimary, fontSize: 24, lineHeight: 27, fontWeight: "800" }, featureBody: { color: colors.onBrandPrimary, fontSize: 12, opacity: 0.86 }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, sectionTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" }, sectionHint: { color: colors.muted, fontSize: 12 }, menuGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, foodCard: { width: "48%", minWidth: 145, backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 10 }, cardPressed: { transform: [{ scale: 0.98 }] }, foodArt: { height: 112, borderRadius: 12, alignItems: "center", justifyContent: "center", position: "relative" }, addButton: { position: "absolute", right: 7, bottom: 7, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }, foodName: { color: colors.onSurface, fontSize: 14, fontWeight: "800", marginTop: 9 }, foodCategory: { color: colors.muted, fontSize: 11, marginTop: 3 }, foodPrice: { color: colors.brandPrimary, fontSize: 14, fontWeight: "900", marginTop: 5 }, empty: { alignItems: "center", paddingVertical: 42, gap: 8 }, emptyTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" }, emptyCopy: { color: colors.muted, fontSize: 13, textAlign: "center" }, backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, detailArt: { height: 210, borderRadius: 22, alignItems: "center", justifyContent: "center" }, detailTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, detailPrice: { color: colors.brandPrimary, fontSize: 21, fontWeight: "900" }, detailDescription: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21 }, optionTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800" }, noteInput: { minHeight: 74, textAlignVertical: "top", paddingTop: 14 }, quantityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, stepper: { flexDirection: "row", alignItems: "center", gap: 12 }, stepButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }, quantity: { color: colors.onSurface, fontWeight: "800", minWidth: 18, textAlign: "center" }, titleRow: { flexDirection: "row", alignItems: "center", gap: 12 }, cartList: { gap: 10 }, cartItem: { minHeight: 78, backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 }, smallFoodArt: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }, cartItemCopy: { flex: 1 }, summary: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16, gap: 12 }, summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, summaryValue: { color: colors.onSurface, fontSize: 13, fontWeight: "700" }, divider: { height: 1, backgroundColor: colors.divider }, totalLabel: { color: colors.onSurface, fontSize: 15, fontWeight: "800" }, totalValue: { color: colors.brandPrimary, fontSize: 18, fontWeight: "900" }, outlineButton: { borderWidth: 1, borderColor: colors.brandPrimary, minHeight: 44, paddingHorizontal: 20, borderRadius: 12, justifyContent: "center", marginTop: 10 }, outlineText: { color: colors.brandPrimary, fontWeight: "800" }, paymentList: { gap: 10 }, paymentOption: { minHeight: 78, borderRadius: 15, borderWidth: 1, borderColor: colors.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, paymentSelected: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }, paymentCopy: { flex: 1 }, secureNote: { color: colors.muted, fontSize: 12, textAlign: "center" }, errorText: { color: colors.error, fontSize: 12, lineHeight: 17 }, statusCard: { alignItems: "center", backgroundColor: colors.brandTertiary, borderRadius: 20, padding: 24, gap: 8 }, orderNumber: { color: colors.brandPrimary, fontSize: 13, fontWeight: "900", marginTop: 4 }, timeline: { gap: 18, paddingLeft: 10 }, timelineRow: { flexDirection: "row", alignItems: "center", gap: 14 }, timelineDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" }, timelineDotActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }, noticeCard: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 14 }, profileHeader: { alignItems: "center", gap: 6, paddingVertical: 8 }, profileAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: 4 }, balanceCard: { backgroundColor: colors.brandTertiary, borderRadius: 18, padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, balance: { color: colors.brandPrimary, fontSize: 28, fontWeight: "900", marginTop: 7 }, profileRow: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: colors.divider, flexDirection: "row", alignItems: "center", gap: 12 }, profileRowText: { color: colors.onSurface, flex: 1, fontSize: 14, fontWeight: "700" }, twilioCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }, twilioIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }, pendingPill: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900" }, signOut: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }, signOutText: { color: colors.error, fontWeight: "800" }, bottomNav: { minHeight: 68, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface, flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingTop: 8 }, navItem: { minWidth: 60, minHeight: 46, alignItems: "center", justifyContent: "center", gap: 2 }, navLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" }, navLabelActive: { color: colors.brandPrimary }, badge: { position: "absolute", top: -4, right: -10, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" }, badgeText: { color: colors.onError, fontSize: 9, fontWeight: "900" },
}));