"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Scanner } from "@/components/scanner";

type GlobalScannerContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const GlobalScannerContext = createContext<GlobalScannerContextValue | null>(null);

export function useGlobalScanner() {
  const ctx = useContext(GlobalScannerContext);
  if (!ctx) throw new Error("useGlobalScanner must be used within GlobalScannerProvider");
  return ctx;
}

function isTextInput(el: HTMLElement | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return true;
  return false;
}

function fillFocusedInput(value: string) {
  const el = document.activeElement as HTMLElement | null;
  if (!el || !isTextInput(el)) return false;
  const input = el as HTMLInputElement | HTMLTextAreaElement;
  if (input.readOnly || input.disabled) return false;
  if (input.closest("[data-scanner-root]")) return false;
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  const setter = descriptor?.set;
  if (setter) setter.call(input, value);
  else (input as unknown as { value: string }).value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  try {
    input.setSelectionRange(value.length, value.length);
  } catch {}
  return true;
}

export function GlobalScannerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const handleScan = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    fillFocusedInput(trimmed);
    window.dispatchEvent(new CustomEvent("fig:scanner-scan", { detail: { value: trimmed } }));
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <GlobalScannerContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
      {isOpen && (
        <div data-scanner-root>
          <Scanner title="Scan IMEI or barcode" onScan={handleScan} onClose={close} />
        </div>
      )}
    </GlobalScannerContext.Provider>
  );
}

export function useScannerScan(handler: (value: string) => void, deps: unknown[] = []) {
  useEffect(() => {
    function onScan(e: Event) {
      const ce = e as CustomEvent<{ value: string }>;
      handler(ce.detail.value);
    }
    window.addEventListener("fig:scanner-scan", onScan as EventListener);
    return () => window.removeEventListener("fig:scanner-scan", onScan as EventListener);
  }, deps);
}
