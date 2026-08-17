import type { Role } from "@/lib/constants/users";

export type CashSession = {
  id: string;
  number: string;
  openedAt: string;
  openingFloat: string;
  closedAt: string | null;
  closingFloat: string | null;
  countedFloat: string | null;
  variance: string | null;
  note: string | null;
  status: "OPEN" | "CLOSED";
  openedBy: { id: string; name: string };
  closedBy: { id: string; name: string } | null;
};

export type ZReport = {
  from: string;
  to: string;
  openingFloat: number;
  cashIn: number;
  cashOut: number;
  expectedClosing: number;
  saleCash: number;
  saleReturnCash: number;
  purchaseCash: number;
  purchaseReturnCash: number;
  vouchersIn: number;
  vouchersOut: number;
  expenses: number;
};

export type PurchaseOrderItem = {
  id: string;
  quantity: number;
  receivedQuantity: number;
  costPrice: string;
  product: { id: string; brand: { name: string } | null; model: string; storage: string | null; ram: string | null };
};

export type PurchaseOrder = {
  id: string;
  number: string;
  status: "PENDING" | "PARTIAL" | "RECEIVED" | "CANCELLED";
  total: string;
  note: string | null;
  receivedAt: string | null;
  createdAt: string;
  contact: { id: string; name: string; phone: string | null };
  createdBy: { id: string; name: string };
  items: PurchaseOrderItem[];
};

export type CategoryType = "PHONE" | "ACCESSORY";

export type CompanyProfile = {
  id: string;
  name: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  footerText: string | null;
  currency: string;
  currencySymbol: string;
  taxRate: string;
  cardFee: string;
  timezone: string | null;
  compactPrices: boolean;
  raastId: string | null;
  whatsapp: string | null;
  website: string | null;
};

export type AdminUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
  active: boolean;
  permissions: string[];
  createdAt: string;
  system?: boolean;
};

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  _count?: { products: number };
};

export type Brand = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  _count?: { products: number };
};

export type Color = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  _count?: { products: number };
};

export type ProductSummary = {
  id: string;
  brandId: string;
  brand: string;
  model: string;
  storage: string | null;
  ram: string | null;
  screenSize: string | null;
  colorId: string | null;
  color: string | null;
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  sku: string | null;
  image?: string | null;
  sellPrice: string;
  costPrice?: string;
  retailPrice?: string | null;
  lowStockThreshold: number;
  inStock: number;
  newInStock: number;
  usedInStock: number;
};

export type Product = {
  id: string;
  brandId: string;
  brand: string;
  model: string;
  storage: string | null;
  ram: string | null;
  screenSize: string | null;
  colorId: string | null;
  color: string | null;
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  sku: string | null;
  barcode: string | null;
  image?: string | null;
  specs: string | null;
  sellPrice: string;
  costPrice: string;
  retailPrice?: string | null;
  lowStockThreshold: number;
  units: { id: string; imei: string; condition: "NEW" | "USED"; carrier: "NON_PTA" | "PTA" | "SIM_LOCKED" }[];
};

export type ProductPriceEntry = {
  id: string;
  sellPrice: string;
  costPrice: string;
  fromDate: string;
};

export type ProductDetail = {
  id: string;
  brand: { id: string; name: string };
  model: string;
  sellPrice: string;
  costPrice: string;
  retailPrice: string | null;
  priceHistory: ProductPriceEntry[];
};

export type Unit = {
  id: string;
  imei: string;
  condition: "NEW" | "USED";
  status: "IN_STOCK" | "RESERVED" | "SOLD" | "RETURNED" | "DAMAGED" | "WRITTEN_OFF";
  source: string;
  carrier: "NON_PTA" | "PTA" | "SIM_LOCKED";
  batteryHealth: number | null;
  grade: string | null;
  costPrice?: string;
  acquiredAt: string;
  product: {
    id: string;
    brand: string;
    model: string;
    storage: string | null;
    ram: string | null;
    screenSize: string | null;
    colorId: string | null;
    color: string | null;
    category: string | null;
    sellPrice: string | null;
    retailPrice: string | null;
  };
  purchase: {
    id: string;
    invoice: string;
    date: string;
    vendor: string;
  } | null;
};

export type InventoryProduct = {
  id: string;
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  category: string | null;
  barcode: string | null;
  sellPrice: string | null;
  retailPrice: string | null;
  costPrice?: string;
  qty: number;
  lastPurchasedAt: string | null;
  lastVendor: string | null;
};

export type InventoryLowStock = {
  id: string;
  brand: string;
  model: string;
  storage: string | null;
  inStock: number;
  threshold: number;
};

export type City = {
  id: string;
  name: string;
};

export type InventoryData = {
  units: Unit[];
  products: InventoryProduct[];
  lowStock: InventoryLowStock[];
  valuation: {
    costValue: number | null;
    retailValue: number;
    potentialProfit: number | null;
  };
  byCondition: {
    condition: string;
    units: number;
    costValue: number | null;
    retailValue: number;
  }[];
};

export type Contact = {
  id: string;
  type: "WALK_IN" | "CUSTOMER" | "VENDOR" | "BOTH";
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  cnic: string | null;
  photoUrl: string | null;
  cnicFrontUrl: string | null;
  cnicBackUrl: string | null;
  notes: string | null;
  createdAt: string;
  transactionCount: number;
  creditBalance: string;
  creditLimit: string;
  receivable: string;
  payable: string;
};

export type ContactDuplicate = {
  id: string;
  type: "WALK_IN" | "CUSTOMER" | "VENDOR" | "BOTH";
  name: string;
  phone: string | null;
  email: string | null;
  creditLimit: string;
  transactionCount: number;
};

export type ContactDetail = Contact & {
  creditAccount: {
    id: string;
    balance: string;
    limit: string;
    creditPayments: {
      id: string;
      amount: string;
      receivedFrom: string | null;
      dueDate: string | null;
      paidAt: string;
    }[];
  } | null;
  transactions: {
    id: string;
    number: string;
    type: string;
    total: string;
    status: string;
    createdAt: string;
  }[];
};

export type BankAccount = {
  id: string;
  name: string;
  bankName: string;
  accountNo: string;
  holderName: string | null;
  iban: string | null;
  isDefault: boolean;
  active: boolean;
};

export type MoneyBankBalance = {
  id: string;
  name: string;
  bankName: string;
  accountNo: string;
  balance: number;
};

export type MoneyOverview = {
  cashBalance: number;
  banks: MoneyBankBalance[];
  totalBankBalance: number;
  pendingCard: number;
  receivables: number;
  payables: number;
  summary: {
    cash: number;
    bank: number;
    cardPending: number;
    credit: number;
  };
};

export type MoneyMovement = {
  id: string;
  date: string;
  kind: "IN" | "OUT" | "TRANSFER";
  amount: string;
  account: "cash" | "bank";
  bankAccount: { id: string; name: string; bankName: string } | null;
  sourceType: string;
  sourceId: string | null;
  note: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
};

export type Voucher = {
  id: string;
  type: "RECEIVING" | "PAYMENT";
  number: string;
  amount: string;
  method: "CASH" | "BANK_TRANSFER" | "CARD";
  bankAccount: { id: string; name: string; bankName: string; accountNo: string } | null;
  contact: { id: string; name: string; phone: string | null } | null;
  narration: string | null;
  date: string;
  status: "ACTIVE" | "REVERSED";
  reversedBy: { id: string; name: string } | null;
  reversedAt: string | null;
  reversalNote: string | null;
  user: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export type Expense = {
  id: string;
  number: string;
  category: string;
  amount: string;
  note: string | null;
  contact: { id: string; name: string; phone: string | null } | null;
  date: string;
};

export type Transaction = {
  id: string;
  type: "SALE" | "PURCHASE" | "SALE_RETURN" | "PURCHASE_RETURN";
  number: string;
  contact: { id: string; name: string; phone: string | null };
  user: { id: string; name: string };
  subtotal: string;
  discount: string;
  tax: string;
  cardFee: string;
  total: string;
  status: "PAID" | "PARTIAL" | "PENDING" | "REFUNDED";
  note: string | null;
  createdAt: string;
  _count: { items: number };
  payments: { method: string; amount: string }[];
};

export type TransactionDetail = {
  id: string;
  number: string;
  type: string;
  subtotal: string;
  discount: string;
  tax: string;
  cardFee: string;
  total: string;
  status: string;
  note: string | null;
  createdAt: string;
  contact: { id: string; name: string; phone: string | null };
  user: { id: string; name: string };
  items: {
    id: string;
    quantity: number;
    unitPrice: string;
    discount: string;
    total: string;
    product: { id: string; brand: string; model: string; storage: string | null; ram: string | null };
    unit: { id: string; imei: string; status: string; costPrice?: string } | null;
  }[];
  payments: {
    id: string;
    method: string;
    amount: string;
    tendered: string | null;
    change: string | null;
    reference: string | null;
    bankAccount: { id: string; name: string; bankName: string; accountNo: string; holderName: string | null } | null;
  }[];
};

export type ReservationDetail = {
  id: string;
  number: string;
  type: "RESERVATION" | "CONSIGNMENT";
  subtotal: string;
  discount: string;
  total: string;
  advance: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  refundStatus: "PENDING" | "PAID" | null;
  refundedAt: string | null;
  note: string | null;
  createdAt: string;
  contact: { id: string; name: string; phone: string | null };
  user: { id: string; name: string };
  items: {
    id: string;
    quantity: number;
    unitPrice: string;
    discount: string;
    total: string;
     product: {
      id: string;
      brand: string | { id: string; name: string };
      model: string;
      storage: string | null;
      ram: string | null;
      screenSize: string | null;
      color: string | null;
    };
    unit: { id: string; imei: string; status: string } | null;
  }[];
  sale: { id: string; number: string } | null;
};

export type ReservationConflict = {
  reservationId: string;
  reservationNumber: string;
  contactName: string;
  contactPhone: string | null;
  total: string;
  advance: string;
  createdAt: string;
  units: { unitId: string; imei: string }[];
};

export function brandOf(p: { brand: string | { id: string; name: string } }): string {
  return typeof p.brand === "string" ? p.brand : p.brand.name;
}

export type StockMovement = {
  id: string;
  type: "IN" | "OUT" | "ADJUST" | "TRANSFER" | "RESERVED" | "RELEASED";
  qty: number;
  note: string | null;
  createdAt: string;
  unit: { id: string; imei: string; condition: string; status: string } | null;
  product: { id: string; brand: string; model: string; storage: string | null } | null;
};

export type ReturnEligibility = {
  eligible: boolean;
  code?: string;
  reason?: string;
  unit?: {
    id: string;
    imei: string;
    condition: string;
    status: string;
    source: string;
    carrier: string;
    batteryHealth: number | null;
    grade: string | null;
    costPrice?: string;
    product: { brand: string; model: string; storage: string | null; ram: string | null; screenSize: string | null; color: string | null };
  };
  purchaseId?: string;
  purchaseNumber?: string;
  saleId?: string;
  saleNumber?: string;
  refund?: number;
  contact?: { id: string; name: string };
};

export type DashboardOverview = {
  today: {
    salesCount: number;
    revenue: number;
    profit: number | null;
    purchasesCount: number;
    purchasesAmount: number;
    expensesAmount: number;
    expensesCount: number;
    cashIn: number;
    cashOut: number;
    returns: { sale: number; purchase: number };
  };
  all: {
    salesCount: number;
    revenue: number;
    purchasesCount: number;
    purchasesAmount: number;
  };
  stock: { NEW: number; USED: number; total: number };
  stockValue: { cost: number | null; retail: number };
  carrierSplit: { PTA: number; NON_PTA: number; SIM_LOCKED: number };
  reservations: { active: number; total: number; advance: number; consignments: number };
  credit: { receivables: number; payables: number };
  topSellers: { id: string; name: string; count: number; revenue: number }[];
  soldByCategory: { PHONE: number; ACCESSORY: number };
  lowStock: {
    id: string;
    brand: string;
    model: string;
    storage: string | null;
    inStock: number;
    threshold: number;
  }[];
  salesTrend: { key: string; label: string; revenue: number; count: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  paymentSplit: { CASH: number; CARD: number; BANK_TRANSFER: number; CREDIT: number };
  newUsedSold: { NEW: number; USED: number };
  profitTrend: number[] | null;
  recent: {
    id: string;
    number: string;
    type: string;
    total: string;
    createdAt: string;
    contact: { name: string };
    user: { name: string };
  }[];
};

export type ActivityLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: string | null;
  createdAt: string;
  user: { id: string; name: string; username: string };
};

export type DashboardWidget = {
  id: string;
  key: string;
  layout: string;
  settings: string;
  order: number;
};

export type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "CREDIT";

export type ReportRange = { from?: string; to?: string };

export type ReportSummary = {
  period: ReportRange;
  sales: { count: number; revenue: number };
  purchases: { count: number; amount: number };
  expenses: { count: number; amount: number };
  vouchers: { count: number; receiving: number; payment: number };
  itemsSold: { total: number; new: number; used: number };
  profit: number | null;
  paymentSplit: { method: PaymentMethod; amount: number }[];
  receivables: number;
  payables: number;
};

export type SalesReport = {
  count: number;
  revenue: number;
  subtotal: number;
  discount: number;
  items: number;
  byCondition: { condition: string; count: number; revenue: number; items: number }[];
  byBrand: { name: string; count: number; revenue: number }[];
  byCategory: { name: string; type: string; count: number; revenue: number }[];
  byPayment: { method: PaymentMethod; amount: number; count: number }[];
  byUser: { name: string; count: number; revenue: number }[];
  daily: { date: string; revenue: number; count: number }[];
};

export type PurchaseReport = {
  count: number;
  amount: number;
  subtotal: number;
  discount: number;
  units: number;
  byCondition: { condition: string; count: number; amount: number; units: number }[];
  byVendor: { name: string; count: number; amount: number; units: number }[];
  daily: { date: string; amount: number; count: number }[];
};

export type ProfitReport = {
  revenue: number;
  cost: number;
  expenses: number;
  profit: number;
  margin: number;
  daily: { date: string; revenue: number; cost: number; expense: number; profit: number }[];
  byBrand: { name: string; revenue: number; cost: number; profit: number }[];
  byCondition: { condition: string; revenue: number; cost: number; profit: number }[];
  byModel: { name: string; revenue: number; cost: number; profit: number }[];
};

export type ExpenseReport = {
  total: number;
  count: number;
  byCategory: { category: string; count: number; total: number }[];
  daily: { date: string; total: number; count: number }[];
};

export type StockReport = {
  units: number;
  costValue: number | null;
  retailValue: number;
  byCondition: { condition: string; units: number; costValue: number; retailValue: number }[];
  byCategory: { name: string; units: number; costValue: number; retailValue: number }[];
  byBrand: { name: string; units: number; costValue: number; retailValue: number }[];
};

export type PaymentsReport = {
  byMethod: { method: PaymentMethod; amount: number; count: number }[];
  byBankAccount: {
    id: string;
    name: string;
    bankName: string;
    accountNo: string;
    amount: number;
    count: number;
  }[];
  inflows: { label: string; amount: number }[];
  outflows: { label: string; amount: number }[];
  totalIn: number;
  totalOut: number;
};

export type BalanceRow = {
  contactId: string;
  name: string;
  phone: string | null;
  count: number;
  total: number;
  paid: number;
  outstanding: number;
  source: "CREDIT" | "REFUND";
};

export type BalancesReport = {
  receivables: BalanceRow[];
  payables: BalanceRow[];
  receivableTotal: number;
  payableTotal: number;
};

export type AgingBucket = { key: string; label: string; amount: number; count: number };

export type AgingSide = {
  buckets: AgingBucket[];
  overdue: number;
  total: number;
  rows: {
    id: string;
    number: string;
    date: string;
    contactId: string;
    name: string;
    phone: string | null;
    total: number;
    paid: number;
    outstanding: number;
    ageDays: number;
    bucket: string;
  }[];
};

export type AgingReport = {
  receivables: AgingSide;
  payables: AgingSide;
};

export type LedgerRow = {
  id: string;
  date: string;
  type: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number;
};

export type LedgerReport = {
  contact: { id: string; name: string; phone: string | null; type: string };
  rows: LedgerRow[];
  closing: number;
};

export type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: string | null;
  createdAt: string;
  user: { id: string; username: string; name: string };
};

export type AuditLogPage = {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
};

export type AuditMeta = {
  actions: string[];
  entities: string[];
};
