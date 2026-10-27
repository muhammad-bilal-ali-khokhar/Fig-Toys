import { addDays, isPast, maxDate } from "./format";
import type { Client, ClientStatus, Pricing } from "./types";

export function clientStatus(client: Client, now: number): ClientStatus {
  if (client.blocked) return "blocked";
  if (client.lifetime) return "active";
  if (client.paidUntil && !isPast(client.paidUntil, now)) return "active";
  if (!isPast(client.trialEndsAt, now)) return "trial";
  return "expired";
}

export function accessEndsAt(client: Client): string {
  if (client.lifetime) return "9999-12-31T23:59:59.000Z";
  const end = maxDate(client.trialEndsAt, client.paidUntil);
  return end.toISOString();
}

export function renewalBase(client: Client, now: number): Date {
  return maxDate(
    new Date(now).toISOString(),
    client.paidUntil,
    client.trialEndsAt,
  );
}

export function stackExpiry(client: Client, durationDays: number, now: number): string {
  return addDays(renewalBase(client, now), durationDays).toISOString();
}

export function monthlyPrice(client: Client, pricing: Pricing): number {
  return client.monthlyPricePkr > 0
    ? client.monthlyPricePkr
    : pricing.defaultMonthlyPricePkr;
}

const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChars(length: number): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => KEY_ALPHABET[byte % KEY_ALPHABET.length]).join("");
}

export function generateLicenseKey(): string {
  return `FIG-${randomChars(4)}-${randomChars(4)}-${randomChars(4)}`;
}

export function maskDeviceId(deviceId: string): string {
  if (deviceId.length <= 8) return deviceId;
  return `${deviceId.slice(0, 4)}...${deviceId.slice(-4)}`;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[^0-9]/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

export function normalizePhone(value: string): string {
  return value.replace(/[^0-9+]/g, "").trim();
}
