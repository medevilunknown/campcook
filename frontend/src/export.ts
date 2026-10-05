import { Platform } from "react-native";

import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { formatTime, KitchenOrder, PAYMENT_LABEL, SalesSummary, STATUS_LABEL } from "@/src/caterer";

function esc(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadWeb(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildCsv(sales: SalesSummary, orders: KitchenOrder[]): string {
  const rows = [
    "CampCook daily sales report",
    `Date,${sales.date}`,
    `Total revenue (INR),${sales.total_revenue}`,
    `Orders,${sales.order_count}`,
    `Completed,${sales.completed_count}`,
    "",
    ["Order ID", "Time", "Source", "Customer", "Phone", "Items", "Payment", "Payment status", "Status", "Amount (INR)"].join(","),
    ...orders.map((order) =>
      [
        order.id,
        formatTime(order.created_at),
        order.source ?? "app",
        order.customer_name ?? "",
        order.customer_phone ?? "",
        order.lines.map((line) => `${line.quantity}x ${line.name}`).join("; "),
        PAYMENT_LABEL[order.payment_method] ?? order.payment_method,
        order.payment_status ?? "",
        STATUS_LABEL[order.status] ?? order.status,
        String(order.amount),
      ]
        .map(esc)
        .join(","),
    ),
  ];
  return rows.join("\n");
}

export function buildHtml(sales: SalesSummary, orders: KitchenOrder[]): string {
  const rows = orders
    .map(
      (order) => `<tr>
        <td>${order.id}</td>
        <td>${formatTime(order.created_at)}</td>
        <td>${order.source === "offline" ? "Offline" : "App"}</td>
        <td>${order.customer_name ?? "-"}</td>
        <td>${order.lines.map((line) => `${line.quantity}x ${line.name}`).join(", ")}</td>
        <td>${PAYMENT_LABEL[order.payment_method] ?? order.payment_method} (${order.payment_status ?? "pending"})</td>
        <td>${STATUS_LABEL[order.status] ?? order.status}</td>
        <td style="text-align:right">₹${order.amount}</td>
      </tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1A2E22; padding: 24px; }
    h1 { color: #2E5C3E; font-size: 22px; margin-bottom: 2px; }
    .sub { color: #5A7363; font-size: 12px; margin-bottom: 18px; }
    .hero { background: #2E5C3E; color: #fff; border-radius: 12px; padding: 16px; margin-bottom: 18px; }
    .hero .amount { font-size: 28px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #E5EBE1; text-align: left; padding: 7px; }
    td { padding: 7px; border-bottom: 1px solid #E2EADE; vertical-align: top; }
  </style></head><body>
    <h1>CampCook — Daily sales report</h1>
    <div class="sub">${sales.date} · Generated from the caterer workspace</div>
    <div class="hero"><div class="amount">₹${sales.total_revenue}</div>
    <div>${sales.order_count} orders · ${sales.completed_count} completed · ${sales.active_count} active</div></div>
    <table><thead><tr><th>Order</th><th>Time</th><th>Source</th><th>Customer</th><th>Items</th><th>Payment</th><th>Status</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </body></html>`;
}

export async function shareCsv(filename: string, csv: string): Promise<string | null> {
  if (Platform.OS === "web") {
    downloadWeb(filename, csv, "text/csv");
    return null;
  }
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv);
  if (!(await Sharing.isAvailableAsync())) return "Sharing is not available on this device.";
  await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "Share sales CSV" });
  return null;
}

export async function sharePdf(filename: string, html: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return "PDF export works in the mobile app — use CSV here, or open CampCook in Expo Go.";
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) return "Sharing is not available on this device.";
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share daily sales PDF" });
  return null;
}
