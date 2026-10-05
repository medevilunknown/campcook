import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getSession, MenuItem, Order, request, SESSION_KEY } from "@/src/api";
import { consumeInitialUrl, consumeWebCallback, exchangeSessionId, extractSessionId } from "@/src/google-auth";
import { storage } from "@/src/utils/storage";
import * as Linking from "expo-linking";

export type Session = { token: string; user: Record<string, string | number> };

type AppContextValue = {
  session: Session | null;
  loadingSession: boolean;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  menu: MenuItem[];
  menuError: string;
  refreshMenu: () => void;
  cart: Record<string, number>;
  cartCount: number;
  addToCart: (item: MenuItem, quantity?: number) => void;
  updateQuantity: (item: MenuItem, delta: number) => void;
  clearCart: () => void;
  selected: MenuItem | null;
  setSelected: (item: MenuItem | null) => void;
  activeOrder: Order | null;
  setActiveOrder: (order: Order | null) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuError, setMenuError] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Google callback must be processed before any stored-session restore.
      const googleSession = (await consumeWebCallback()) ?? (await consumeInitialUrl());
      if (googleSession) {
        await storage.secureSet(SESSION_KEY, googleSession);
        if (!cancelled) {
          setSession(googleSession);
          setLoadingSession(false);
        }
        return;
      }
      const value = await getSession();
      if (value) {
        try {
          await request("/auth/me", {}, value.token);
        } catch (e) {
          if ((e as Error).message.toLowerCase().includes("sign in")) {
            await storage.secureRemove(SESSION_KEY);
            if (!cancelled) {
              setSession(null);
              setLoadingSession(false);
            }
            return;
          }
        }
      }
      if (!cancelled) {
        setSession(value);
        setLoadingSession(false);
      }
    })();
    // Hot deep links: Google redirect arriving while the app is running.
    const subscription = Linking.addEventListener("url", (event) => {
      const sessionId = extractSessionId(event.url);
      if (!sessionId) return;
      exchangeSessionId(sessionId).then(async (googleSession) => {
        if (googleSession) {
          await storage.secureSet(SESSION_KEY, googleSession);
          setSession(googleSession);
        }
      });
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const refreshMenu = useCallback(() => {
    if (!session) return;
    request<MenuItem[]>("/menu", {}, session.token)
      .then((value) => {
        setMenu(value);
        setMenuError("");
      })
      .catch((e: Error) => setMenuError(e.message));
  }, [session]);

  useEffect(() => {
    refreshMenu();
  }, [refreshMenu]);

  const signIn = useCallback(async (value: Session) => {
    await storage.secureSet(SESSION_KEY, value);
    setSession(value);
  }, []);

  const signOut = useCallback(async () => {
    await storage.secureRemove(SESSION_KEY);
    setSession(null);
    setCart({});
    setSelected(null);
    setActiveOrder(null);
  }, []);

  const addToCart = useCallback((item: MenuItem, quantity = 1) => {
    setCart((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + quantity }));
  }, []);

  const updateQuantity = useCallback((item: MenuItem, delta: number) => {
    setCart((current) => {
      const next = Math.max(0, (current[item.id] ?? 0) + delta);
      const updated = { ...current };
      if (next === 0) delete updated[item.id];
      else updated[item.id] = next;
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => setCart({}), []);

  const cartCount = useMemo(() => Object.values(cart).reduce((total, count) => total + count, 0), [cart]);

  const value = useMemo(
    () => ({ session, loadingSession, signIn, signOut, menu, menuError, refreshMenu, cart, cartCount, addToCart, updateQuantity, clearCart, selected, setSelected, activeOrder, setActiveOrder }),
    [session, loadingSession, signIn, signOut, menu, menuError, refreshMenu, cart, cartCount, addToCart, updateQuantity, clearCart, selected, activeOrder],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
