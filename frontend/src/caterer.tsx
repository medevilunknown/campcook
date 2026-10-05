import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ThemeColors } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export const CATERER_KEY = "campcook.caterer";

export type CatererSession = { token: string; user: Record<string, string> };

export type KitchenLine = { item_id?: string; name: string; quantity: number; unit_price: number };

export type KitchenOrder = {
  id: string;
  amount: number;
  status: string;
  payment_method: string;
  payment_status?: string;
  source?: string;
  customer_name?: string;
  customer_phone?: string;
  pickup_time?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  lines: KitchenLine[];
};

export type SalesSummary = {
  date: string;
  total_revenue: number;
  order_count: number;
  completed_count: number;
  active_count: number;
  by_payment_method: Record<string, number>;
  by_source: Record<string, number>;
  status_counts: Record<string, number>;
  top_items: { name: string; quantity: number }[];
};

export const NEXT_ACTION: Record<string, { next: string; label: string; icon: string }> = {
  placed: { next: "accepted", label: "Accept", icon: "checkmark" },
  accepted: { next: "preparing", label: "Start prep", icon: "flame-outline" },
  preparing: { next: "ready", label: "Mark ready", icon: "bag-check-outline" },
  ready: { next: "completed", label: "Complete", icon: "checkmark-done" },
};

export const STATUS_LABEL: Record<string, string> = {
  placed: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  payment_pending: "Payment pending",
};

export const PAYMENT_LABEL: Record<string, string> = { cash: "Cash", razorpay: "Razorpay", upi: "UPI", card: "Card" };

export function statusTone(colors: ThemeColors, status: string): { bg: string; fg: string } {
  switch (status) {
    case "placed":
      return { bg: colors.info, fg: colors.onInfo };
    case "accepted":
      return { bg: colors.warning, fg: colors.onWarning };
    case "preparing":
      return { bg: colors.brandSecondary, fg: colors.onBrandSecondary };
    case "ready":
      return { bg: colors.success, fg: colors.onSuccess };
    case "completed":
      return { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary };
    default:
      return { bg: colors.surfaceSecondary, fg: colors.onSurfaceSecondary };
  }
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type CatererContextValue = {
  session: CatererSession | null;
  loading: boolean;
  signIn: (session: CatererSession) => Promise<void>;
  signOut: () => Promise<void>;
};

const CatererContext = createContext<CatererContextValue | null>(null);

export function CatererProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<CatererSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storage.secureGet(CATERER_KEY, null).then((value) => {
      setSession(value as CatererSession | null);
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async (value: CatererSession) => {
    await storage.secureSet(CATERER_KEY, value);
    setSession(value);
  }, []);

  const signOut = useCallback(async () => {
    await storage.secureRemove(CATERER_KEY);
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, loading, signIn, signOut }), [session, loading, signIn, signOut]);
  return <CatererContext.Provider value={value}>{children}</CatererContext.Provider>;
}

export function useCaterer(): CatererContextValue {
  const context = useContext(CatererContext);
  if (!context) throw new Error("useCaterer must be used within CatererProvider");
  return context;
}
