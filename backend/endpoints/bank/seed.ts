import { prisma } from "../../core/lib/prisma";

export const PAKISTAN_BANKS = [
  "Meezan Bank",
  "HBL",
  "UBL",
  "MCB Bank",
  "Allied Bank",
  "Bank Alfalah",
  "Bank Al Habib",
  "Habib Metropolitan Bank",
  "Faysal Bank",
  "Bank Islami",
  "Dubai Islamic Bank",
  "Standard Chartered Bank",
  "Askari Bank",
  "National Bank of Pakistan",
  "Bank of Punjab",
  "Bank of Khyber",
  "JS Bank",
  "Soneri Bank",
  "Silk Bank",
  "Summit Bank",
  "Sindh Bank",
  "SME Bank",
  "First Women Bank",
  "Al Baraka Bank",
  "MCB Islamic Bank",
  "Khushhali Microfinance Bank",
  "Samba Bank",
  "Mashreq Bank",
  "ICBC",
  "Bank of China",
  "Zarai Taraqiati Bank",
  "Industrial Development Bank of Pakistan",
  "Punjab Provincial Cooperative Bank",
  "HBL Microfinance Bank",
  "FINCA Microfinance Bank",
  "NRSP Microfinance Bank",
  "U Microfinance Bank",
  "First MicroFinance Bank",
  "Apna Microfinance Bank",
  "Advans Pakistan Microfinance Bank",
  "Easypaisa",
  "JazzCash",
  "UPaisa",
  "NayaPay",
  "SadaPay",
  "Zindigi",
];

export async function seedBanks() {
  const created = [];
  for (const [index, name] of PAKISTAN_BANKS.entries()) {
    const existing = await prisma.bank.findUnique({ where: { name } });
    if (existing) continue;
    created.push(await prisma.bank.create({ data: { name, sortOrder: index } }));
  }
  return created;
}
