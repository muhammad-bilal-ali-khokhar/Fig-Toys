import { DEFAULT_TIMEZONE } from "@/lib/constants";

export type CompanyForm = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  timezone: string;
};

export type AdminForm = {
  name: string;
  username: string;
  pin: string;
};

export type BankForm = {
  bankName: string;
  name: string;
  accountNo: string;
  holderName: string;
  iban: string;
};

export const EMPTY_COMPANY: CompanyForm = {
  name: "",
  tagline: "",
  address: "",
  phone: "",
  email: "",
  currency: "PKR",
  timezone: DEFAULT_TIMEZONE,
};

export const EMPTY_ADMIN: AdminForm = {
  name: "",
  username: "",
  pin: "",
};

export const EMPTY_BANK: BankForm = {
  bankName: "",
  name: "",
  accountNo: "",
  holderName: "",
  iban: "",
};