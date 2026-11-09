"use client";

import type { CompanyProfile, ProductSummary } from "@/lib/api-types";
import type { LabelConfig } from "@/lib/constants";
import { formatPKR } from "@/lib/money";
import { Barcode } from "@/components/products/barcode";

export function ProductLabel({
  product,
  company,
  config,
}: {
  product: ProductSummary;
  company: CompanyProfile | null;
  config: LabelConfig;
}) {
  const code = product.barcode ?? product.sku ?? product.id;
  const name = [config.showBrand ? product.brand : "", config.showModel ? product.model : ""].filter(Boolean).join(" ");
  const meta = [config.showCategory ? product.categoryName : "", config.showAge ? product.ageRange : ""].filter(Boolean).join(" · ");
  const base = config.fontSize;
  const pad = Math.max(1, Math.round(config.widthMm * 0.035));

  return (
    <div
      className="flex flex-col overflow-hidden bg-white text-ink-900"
      style={{ width: `${config.widthMm}mm`, height: `${config.heightMm}mm`, padding: `${pad}mm`, gap: `${Math.max(0.4, config.heightMm * 0.02)}mm` }}
    >
      <div className="min-w-0 shrink-0">
        {config.showShop && company?.name && (
          <p className="truncate font-semibold uppercase leading-tight tracking-wide text-ink-500" style={{ fontSize: base * 0.7 }}>{company.name}</p>
        )}
        {name && <p className="truncate font-extrabold leading-tight" style={{ fontSize: base * 1.15 }}>{name}</p>}
        {meta && <p className="truncate leading-tight text-ink-600" style={{ fontSize: base * 0.78 }}>{meta}</p>}
      </div>
      {config.showPrice && (
        <p className="shrink-0 truncate font-extrabold leading-none text-brand-700" style={{ fontSize: base * 1.55 }}>{formatPKR(product.sellPrice)}</p>
      )}
      <div className="flex min-h-0 flex-1 flex-col justify-end">
        {config.showBarcode && (
          <div className="min-h-0 w-full">
            <Barcode value={code} height={config.barcodeHeight} width={1.1} displayValue={false} />
          </div>
        )}
        {config.showSku && <p className="truncate text-center leading-tight text-ink-600" style={{ fontSize: base * 0.7 }}>{code}</p>}
      </div>
    </div>
  );
}
