import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { post } from "@/src/api";

export type GoogleSession = { token: string; user: Record<string, string | number> };

const AUTH_URL = "https://auth.emergentagent.com/";

if (Platform.OS !== "web") {
  WebBrowser.maybeCompleteAuthSession();
}

// One-time guard: a session_id must only be exchanged once, and both the
// auth-session result and the deep-link listener can surface the same one.
const exchanged = new Set<string>();

export function extractSessionId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/[?#&]session_id=([^&#]+)/);
  return match ? match[1] : null;
}

export async function exchangeSessionId(sessionId: string): Promise<GoogleSession | null> {
  if (exchanged.has(sessionId)) return null;
  exchanged.add(sessionId);
  try {
    return await post<GoogleSession>("/auth/session", { session_id: sessionId });
  } catch {
    exchanged.delete(sessionId);
    return null;
  }
}

// Web: the user lands back on "/" with #session_id=... — process it before any session restore.
export async function consumeWebCallback(): Promise<GoogleSession | null> {
  if (Platform.OS !== "web") return null;
  const sessionId = extractSessionId(window.location.href);
  if (!sessionId) return null;
  const session = await exchangeSessionId(sessionId);
  if (session) {
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }
  return session;
}

// Mobile cold start: app killed and reopened via the auth deep link.
export async function consumeInitialUrl(): Promise<GoogleSession | null> {
  if (Platform.OS === "web") return null;
  const sessionId = extractSessionId(await Linking.getInitialURL());
  return sessionId ? exchangeSessionId(sessionId) : null;
}

// Returns the session, "cancelled", or null on failure. On web this navigates away.
export async function startGoogleSignIn(): Promise<GoogleSession | "cancelled" | null> {
  if (Platform.OS === "web") {
    const redirectUrl = `${window.location.origin}/`;
    window.location.href = `${AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;
    return "cancelled";
  }
  const redirectUrl = Linking.createURL("");
  const captured: { current: string | null } = { current: null };
  const subscription = Linking.addEventListener("url", (event) => {
    if (extractSessionId(event.url)) captured.current = event.url;
  });
  try {
    const result = await WebBrowser.openAuthSessionAsync(`${AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`, redirectUrl);
    // Android/Expo Go often reports "dismiss" with no URL even on success — check all three sources.
    const resultUrl = result.type === "success" ? result.url : null;
    const sessionId = extractSessionId(resultUrl) ?? extractSessionId(captured.current) ?? extractSessionId(await Linking.getInitialURL());
    if (!sessionId) return "cancelled";
    return await exchangeSessionId(sessionId);
  } finally {
    subscription.remove();
  }
}
