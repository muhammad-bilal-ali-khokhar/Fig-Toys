import { EXPIRING_SOON_DAYS } from "./constants";
import { daysLeft, maxDate } from "./format";
import { accessEndsAt, clientStatus, monthlyPrice } from "./license";
import type { Client, ClientStatus, PaymentRequest, WebDatabase } from "./types";

export type ClientRow = {
  client: Client;
  status: ClientStatus;
  endsAt: string;
  daysLeft: number;
  price: number;
};

export function toClientRow(client: Client, now: number, db: WebDatabase): ClientRow {
  const endsAt = accessEndsAt(client);
  return {
    client,
    status: clientStatus(client, now),
    endsAt,
    daysLeft: daysLeft(endsAt, now),
    price: monthlyPrice(client, db.pricing),
  };
}

export function clientRows(db: WebDatabase, now: number): ClientRow[] {
  return db.clients.map((client) => toClientRow(client, now, db));
}

export function isExpiringSoon(row: ClientRow): boolean {
  return (
    (row.status === "trial" || row.status === "active") &&
    row.daysLeft <= EXPIRING_SOON_DAYS
  );
}

export function overviewStats(db: WebDatabase, now: number) {
  const rows = clientRows(db, now);
  const pending = db.payments.filter((payment) => payment.status === "pending");
  const monthNow = new Date(now);
  const collected = db.payments
    .filter((payment) => {
      if (payment.status !== "approved" || !payment.reviewedAt) return false;
      const date = new Date(payment.reviewedAt);
      return (
        date.getMonth() === monthNow.getMonth() &&
        date.getFullYear() === monthNow.getFullYear()
      );
    })
    .reduce((total, payment) => total + payment.amountPkr, 0);
  const activeRows = rows.filter((row) => row.status === "active");
  return {
    rows,
    total: rows.length,
    trial: rows.filter((row) => row.status === "trial").length,
    active: activeRows.length,
    expired: rows.filter((row) => row.status === "expired").length,
    blocked: rows.filter((row) => row.status === "blocked").length,
    expiring: rows.filter(isExpiringSoon),
    pending,
    collected,
    monthlyRecurring: activeRows.reduce((total, row) => total + row.price, 0),
  };
}

export function expiringRows(db: WebDatabase, now: number): ClientRow[] {
  return clientRows(db, now)
    .filter(isExpiringSoon)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function lastSixMonths(
  payments: PaymentRequest[],
  now: number,
): Array<{ label: string; value: number }> {
  const base = new Date(now);
  const formatter = new Intl.DateTimeFormat("en-PK", { month: "short" });
  const months: Array<{ label: string; value: number; year: number; month: number }> = [];
  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(base.getFullYear(), base.getMonth() - index, 1);
    months.push({
      label: formatter.format(date),
      value: 0,
      year: date.getFullYear(),
      month: date.getMonth(),
    });
  }
  for (const payment of payments) {
    if (payment.status !== "approved" || !payment.reviewedAt) continue;
    const date = new Date(payment.reviewedAt);
    const bucket = months.find(
      (item) => item.year === date.getFullYear() && item.month === date.getMonth(),
    );
    if (bucket) bucket.value += payment.amountPkr;
  }
  return months.map(({ label, value }) => ({ label, value }));
}

export function lastSeenLabel(client: Client): string {
  return client.lastSeenAt;
}

export function effectiveTrialStart(client: Client): string {
  return maxDate(client.registeredAt, null).toISOString();
}
