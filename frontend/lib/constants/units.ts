export const CARRIER_OPTIONS = ["NON_PTA", "PTA", "SIM_LOCKED"] as const;

export const CARRIER_LABELS: Record<(typeof CARRIER_OPTIONS)[number], string> = {
  NON_PTA: "Non-PTA",
  PTA: "PTA",
  SIM_LOCKED: "Sim Locked (JV)",
};

export const CONDITION_LABELS: Record<"NEW" | "USED", string> = {
  NEW: "New",
  USED: "Used",
};

export const CONDITION_TABS: { value: "" | "NEW" | "USED"; label: string }[] = [
  { value: "", label: "All" },
  { value: "NEW", label: CONDITION_LABELS.NEW },
  { value: "USED", label: CONDITION_LABELS.USED },
];

export const STATUS_LABELS: Record<string, string> = {
  IN_STOCK: "In stock",
  RESERVED: "Reserved",
  SOLD: "Sold",
  RETURNED: "Returned",
  DAMAGED: "Damaged",
  WRITTEN_OFF: "Written off",
};

export type MovementType = "IN" | "OUT" | "ADJUST" | "TRANSFER" | "RESERVED" | "RELEASED";

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  IN: "In",
  OUT: "Out",
  ADJUST: "Adjusted",
  TRANSFER: "Transferred",
  RESERVED: "Reserved",
  RELEASED: "Released",
};

export const MOVEMENT_STYLE: Record<MovementType, string> = {
  IN: "bg-brand-50 text-brand-700",
  OUT: "bg-brand-600 text-white",
  ADJUST: "bg-brand-100 text-brand-700",
  TRANSFER: "bg-ink-200 text-ink-800",
  RESERVED: "bg-brand-300 text-brand-900",
  RELEASED: "bg-brand-50 text-brand-700",
};

export type InventoryColumnKey = "imei" | "color" | "category" | "status" | "carrier" | "vendor" | "purchased" | "sell" | "retail" | "cost";

export const INVENTORY_COLUMNS: { key: InventoryColumnKey; label: string }[] = [
  { key: "imei", label: "IMEI" },
  { key: "color", label: "Color" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "carrier", label: "Carrier" },
  { key: "vendor", label: "Vendor" },
  { key: "purchased", label: "Purchased" },
  { key: "sell", label: "Sell" },
  { key: "retail", label: "Retail" },
  { key: "cost", label: "Cost" },
];

export type InventoryViewMode = "units" | "quantity";

export type InventoryViewSettings = {
  mode: InventoryViewMode;
  blurCost: boolean;
  columns: Record<InventoryColumnKey, boolean>;
};

export const INVENTORY_VIEW_STORAGE_KEY = "fig.inventory.view";

export const DEFAULT_INVENTORY_VIEW: InventoryViewSettings = {
  mode: "units",
  blurCost: true,
  columns: {
    imei: true,
    color: true,
    category: true,
    status: true,
    carrier: true,
    vendor: true,
    purchased: true,
    sell: true,
    retail: true,
    cost: true,
  },
};
