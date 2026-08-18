import { MAX_MONEY_AMOUNT } from "@/lib/constants";

function parseAmount(amount: number | string | null | undefined) {
  return typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
}

function numberFormat(n: number) {
  const hasFraction = Math.round(n) !== n;
  return n.toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
}

export function formatMoney(amount: number | string | null | undefined, symbol = "Rs") {
  return `${symbol} ${numberFormat(parseAmount(amount))}`;
}

export function formatPKR(amount: number | string | null | undefined) {
  return formatMoney(amount, "Rs");
}

export function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function clampMoneyInput(raw: string, max = MAX_MONEY_AMOUNT) {
  const n = parseFloat(raw.replace(/,/g, ""));
  if (Number.isNaN(n)) return raw;
  return n > max ? String(max) : raw;
}

function groupInt(s: string) {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatAmountInput(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    parts[1] = parts.slice(1).join("");
  }
  let int = parts[0].replace(/^0+(?=\d)/, "");
  if (parts[0] === "") int = "";
  const frac = parts[1] !== undefined ? parts[1].slice(0, 2) : "";
  const grouped = int === "" ? "" : groupInt(int);
  return frac ? `${grouped}.${frac}` : grouped;
}

export function formatMoneyCompact(amount: number | string | null | undefined, symbol = "Rs") {
  const n = parseAmount(amount);
  const abs = Math.abs(n);
  const trimmed = (v: number) => {
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  };
  if (abs >= 1_000_000) return `${symbol} ${trimmed(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${symbol} ${trimmed(n / 1_000)}k`;
  return `${symbol} ${numberFormat(n)}`;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordsBelowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}

function wordsBelowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let out = "";
  if (hundreds) out += `${ONES[hundreds]} Hundred`;
  if (rest) out += `${out ? " " : ""}${wordsBelowHundred(rest)}`;
  return out;
}

export function amountInWords(amount: number | string | null | undefined): string {
  const n = Math.floor(Math.abs(parseAmount(amount)));
  if (n === 0) return "Zero Rupees";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${wordsBelowHundred(crore)} Crore`);
  if (lakh) parts.push(`${wordsBelowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${wordsBelowHundred(thousand)} Thousand`);
  if (rest) parts.push(wordsBelowThousand(rest));
  return `${parts.join(" ")} Rupees Only`;
}
