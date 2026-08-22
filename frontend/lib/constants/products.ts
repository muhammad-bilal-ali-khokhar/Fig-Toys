import type { CategoryType } from "@/lib/api-types";

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  PHONE: "Phone",
  ACCESSORY: "Accessory",
};

export const STORAGE_OPTIONS = [
  "8GB",
  "16GB",
  "32GB",
  "64GB",
  "128GB",
  "256GB",
  "512GB",
  "1TB",
  "2TB",
] as const;

export const RAM_OPTIONS = [
  "1GB",
  "2GB",
  "3GB",
  "4GB",
  "6GB",
  "8GB",
  "12GB",
  "16GB",
  "24GB",
] as const;

export const SCREEN_SIZE_OPTIONS = [
  '0.44"',
  '1.77"',
  '1.8"',
  '2.0"',
  '2.4"',
  '2.8"',
  '3.0"',
  '3.2"',
  '3.4"',
  '3.5"',
  '3.8"',
  '4.0"',
  '4.5"',
  '4.7"',
  '5.0"',
  '5.4"',
  '5.5"',
  '5.7"',
  '5.8"',
  '6.0"',
  '6.1"',
  '6.2"',
  '6.3"',
  '6.4"',
  '6.5"',
  '6.6"',
  '6.7"',
  '6.8"',
  '6.9"',
  '7.0"',
  '7.6"',
  '8.0"',
  '8.3"',
  '9.0"',
  '10.0"',
  '10.5"',
  '11.0"',
  '12.0"',
  '12.9"',
] as const;

