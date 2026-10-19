export const RESET_TEXT = {
  title: "Reset data",
  subtitle:
    "Wipe business data and start fresh. Your staff, shop details, license and bank accounts always stay.",
  keepTitle: "Always kept",
  keep: [
    "Users & roles",
    "Shop details & preferences",
    "License",
    "Bank accounts",
    "Brands, categories, colors & cities",
  ],
  note: "Resetting products, stock, customers or sales also clears the purchases, reservations and money records linked to them, so your books stay consistent.",
  confirmTitle: "Reset shop data?",
  confirmMessage:
    "This permanently deletes the selected data and cannot be undone. Type RESET to confirm.",
  confirmWord: "RESET",
  button: "Reset selected data",
  pickOne: "Pick at least one thing to reset.",
  success: "Shop data reset.",
  error: "Reset failed.",
} as const;

export const RESET_SECTIONS = [
  { id: "sales", label: "Sales & purchases", description: "Every sale, purchase and their payments." },
  { id: "inventory", label: "Products & stock", description: "Products, IMEI units and stock history." },
  { id: "contacts", label: "Customers & suppliers", description: "All contacts and their credit balances." },
  { id: "reservations", label: "Reservations", description: "Holds, consignments and refunds." },
  { id: "purchaseOrders", label: "Purchase orders", description: "Orders and their items." },
  { id: "money", label: "Money records", description: "Vouchers, expenses, cash sessions and balances." },
  { id: "logs", label: "Activity & error logs", description: "Audit trail, event and crash logs." },
] as const;

export type ResetSectionId = (typeof RESET_SECTIONS)[number]["id"];
