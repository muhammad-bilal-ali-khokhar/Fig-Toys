export type HelpSectionId =
  | "getting-started"
  | "dashboard"
  | "sales"
  | "stock"
  | "products"
  | "purchases"
  | "people"
  | "reservations"
  | "money"
  | "reports"
  | "printing"
  | "settings"
  | "backup-data"
  | "security"
  | "troubleshooting"
  | "contact-support";

export const HELP_SECTIONS: { id: HelpSectionId; label: string; hint?: string }[] = [
  { id: "getting-started", label: "Getting started", hint: "Setup, login, roles" },
  { id: "dashboard", label: "Dashboard", hint: "Overview at a glance" },
  { id: "sales", label: "Sales & POS", hint: "Selling at the counter" },
  { id: "stock", label: "Stock & inventory", hint: "Track your units" },
  { id: "products", label: "Products", hint: "Templates for stock" },
  { id: "purchases", label: "Purchases", hint: "Buying new stock" },
  { id: "people", label: "Contacts & credit", hint: "Customers, vendors" },
  { id: "reservations", label: "Reservations & vouchers", hint: "Hold & prepay" },
  { id: "money", label: "Money & expenses", hint: "Cash and bank" },
  { id: "reports", label: "Reports", hint: "Understand your shop" },
  { id: "printing", label: "Printing", hint: "Receipts & slips" },
  { id: "settings", label: "Settings", hint: "Configure the app" },
  { id: "backup-data", label: "Backup & data", hint: "Backup, restore, offline" },
  { id: "security", label: "Security & encryption", hint: "Local, online, USB key" },
  { id: "troubleshooting", label: "Troubleshooting", hint: "Common issues" },
  { id: "contact-support", label: "Contact & support", hint: "Reach the team" },
];

export const DEVELOPER = {
  studio: "Wavlon Studio",
  company: "MYKO Pvt Ltd",
  email: "arsalan@myko.pk",
  phone: "+92 305 6561991",
  whatsapp: "+92 313 4463066",
  website: "https://wavlon.com",
  websiteAlt: "https://wavlon.pk",
  country: "Pakistan",
} as const;
