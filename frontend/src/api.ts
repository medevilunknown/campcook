import Constants from "expo-constants";

import { storage } from "@/src/utils/storage";

const configuredUrl = Constants.expoConfig?.extra?.backendUrl ?? process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_BASE = `${String(configuredUrl ?? "").replace(/\/$/, "")}/api`;
export const SESSION_KEY = "campcook.session";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  icon: string;
  accent: string;
  popular: boolean;
};

export type Order = {
  id: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  lines: { name: string; quantity: number; unit_price: number }[];
};

export async function getSession(): Promise<{ token: string; user: Record<string, string | number> } | null> {
  return storage.secureGet(SESSION_KEY, null);
}

export async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const session = token ?? (await getSession())?.token;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { "x-session-token": session } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail ?? "Something went wrong. Please try again.");
  return data as T;
}

export const post = <T>(path: string, body: unknown, token?: string) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) }, token);