import { ACTIVITY_ACTION_LABELS } from "@/lib/constants";

export function actionLabel(action: string) {
  return (
    ACTIVITY_ACTION_LABELS[action] ??
    action
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ??
    action
  );
}

export function entityLabel(entity: string) {
  return entity.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function activityDetail(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (typeof d.number === "string") return d.number;
    if (typeof d.name === "string") return d.name;
    if (typeof d.model === "string") return d.model;
    if (typeof d.sku === "string") return d.sku;
    return null;
  } catch {
    return null;
  }
}

export function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}