"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function Barcode({ value, height = 36, width = 2, displayValue = false }: { value: string; height?: number; width?: number; displayValue?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try { JsBarcode(ref.current, value || "000000", { height, width, displayValue, margin: 0, background: "#ffffff", lineColor: "#111827" }); } catch {}
  }, [value, height, width, displayValue]);
  return <svg ref={ref} className="mx-auto max-w-full" />;
}
