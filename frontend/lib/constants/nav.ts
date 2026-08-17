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
      { href: "/purchase-orders", label: "Purchase Orders", icon: "purchases" },
      { href: "/reservations", label: "Reservations", icon: "reservation" },
      { href: "/inventory", label: "Inventory", icon: "inventory" },
      { href: "/products", label: "Products", icon: "products" },
      { href: "/contacts", label: "Contacts", icon: "user" },
      { href: "/vouchers", label: "Vouchers", icon: "voucher" },
      { href: "/reports/money", label: "Money & Bank", icon: "money", permission: PERMISSIONS.moneyView },
      { href: "/expenses", label: "Expenses", icon: "expenses" },
      { href: "/reports", label: "Reports", icon: "reports" },
      { href: "/print", label: "Print Studio", icon: "print" },
      { href: "/settings", label: "Settings", icon: "settings" },
      { href: "/help", label: "Help", icon: "help" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
