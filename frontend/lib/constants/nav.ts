import type { NavIconKey } from "@/components/icons";
import { PERMISSIONS, type Permission } from "@/lib/constants/permissions";

export type NavItem = { href: string; label: string; icon: NavIconKey; permission?: Permission };

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/pos", label: "Sale Invoice", icon: "pos" },
      { href: "/sale-returns", label: "Sale Returns", icon: "refund" },
      { href: "/purchases", label: "Purchases", icon: "purchases" },
      { href: "/purchase-returns", label: "Purchase Returns", icon: "returns" },
      { href: "/rebate", label: "Rebate", icon: "returns" },
      { href: "/purchase-orders", label: "Purchase Orders", icon: "purchases" },
    ],
  },
  {
    title: "Contacts",
    items: [
      { href: "/contacts", label: "Contacts", icon: "user" },
    ],
  },
  {
    title: "Reservations",
    items: [
      { href: "/reservations", label: "Reservations", icon: "reservation" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { href: "/inventory", label: "Inventory", icon: "inventory" },
      { href: "/products", label: "Products", icon: "products" },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/vouchers", label: "Vouchers", icon: "voucher" },
      { href: "/transfers", label: "Transfers", icon: "transfer", permission: PERMISSIONS.moneyWrite },
      { href: "/expenses", label: "Expenses", icon: "expenses" },
      { href: "/reports/money", label: "Money & Bank", icon: "money", permission: PERMISSIONS.moneyView },
      { href: "/reports", label: "Reports", icon: "reports" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/settings", label: "Settings", icon: "settings" },
      { href: "/help", label: "Help", icon: "help" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
