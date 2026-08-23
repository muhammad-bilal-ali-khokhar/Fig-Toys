import { PriceInput } from "./ui/price-input";

const MAX_MONEY_AMOUNT = 9_999_999;

export function DiscountFields({
  pct,
  flat,
  maxFlat,
  onChange,
  className,
}: {
  pct: number;
  flat: number;
  maxFlat?: number;
  onChange: (patch: { pct: number; flat: number }) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <PriceInput
        value={pct}
        max={100}
        onChange={(n) => onChange({ pct: n, flat })}
        className="min-w-0 flex-[0.45] px-1.5 text-right text-xs"
        suffix="%"
      />
      <PriceInput
        value={flat}
        max={maxFlat ?? MAX_MONEY_AMOUNT}
        onChange={(n) => onChange({ pct, flat: n })}
        className="min-w-0 flex-[0.55] px-1.5 text-right text-xs"
        suffix="Rs"
      />
    </div>
  );
}
