import type { ReactNode } from "react";

export type TypePillTone = "brand" | "grey" | "white";

const TONES: Record<TypePillTone, string> = {
  brand: "bg-brand-600 text-white",
  grey: "bg-ink-100 text-ink-600",
  white: "bg-white text-ink-700 border border-ink-200",
};

export function TypePill({
  tone = "grey",
  className,
  children,
}: {
  tone?: TypePillTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

const VOUCHER_TYPE_TONES: Record<"RECEIVING" | "PAYMENT", TypePillTone> = {
  RECEIVING: "brand",
  PAYMENT: "grey",
};

export function VoucherTypePill({ type }: { type: "RECEIVING" | "PAYMENT" }) {
  return <TypePill tone={VOUCHER_TYPE_TONES[type]}>{type === "RECEIVING" ? "Cash receiving" : "Cash payment"}</TypePill>;
}

const EXPENSE_CATEGORY_TONES: Record<string, TypePillTone> = {
  RENT: "brand",
  SALARY: "white",
};

export function ExpenseCategoryPill({ category, label }: { category: string; label?: string }) {
  return (
    <TypePill tone={EXPENSE_CATEGORY_TONES[category] ?? "grey"}>{label ?? category}</TypePill>
  );
}

const CONTACT_TYPE_TONES: Record<string, TypePillTone> = {
  CUSTOMER: "brand",
  VENDOR: "grey",
  WALK_IN: "white",
  BOTH: "brand",
  USED_VENDOR: "grey",
};

export const CONTACT_TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  VENDOR: "Vendor",
  WALK_IN: "Walk-in",
  BOTH: "Customer & vendor",
  USED_VENDOR: "Used phone vendor",
};

export function ContactTypePill({ type }: { type: string }) {
  return <TypePill tone={CONTACT_TYPE_TONES[type] ?? "grey"}>{CONTACT_TYPE_LABELS[type] ?? type.replace("_", " ")}</TypePill>;
}