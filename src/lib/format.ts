export function formatPKR(value: number, compact = false): string {
  const n = Number.isFinite(value) ? value : 0;
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return `PKR ${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `PKR ${(n / 1_000).toFixed(0)}K`;
  }
  return `PKR ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

export function formatNumber(value: number): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString("en-PK");
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysBetween(from: Date, to: Date): number {
  const ms = to.setHours(0, 0, 0, 0) - from.setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return current ? 100 : null;
  return ((current - previous) / previous) * 100;
}
