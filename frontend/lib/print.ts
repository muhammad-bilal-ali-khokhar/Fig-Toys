export type PrintMode = "dialog" | "silent";

const LOCAL_KEY = "fig.print.mode";

export function getLocalPrintMode(): PrintMode | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(LOCAL_KEY);
  return v === "silent" || v === "dialog" ? v : null;
}

export function setLocalPrintMode(mode: PrintMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, mode);
}

export function getEffectivePrintMode(fallback: PrintMode = "dialog"): PrintMode {
  return getLocalPrintMode() ?? fallback;
}

export async function doPrintWithMode(mode: PrintMode) {
  if (mode === "silent") {
    const fig = (typeof window !== "undefined" ? (window as unknown as { fig?: { print?: { silent: () => Promise<unknown>; dialog: () => Promise<unknown> } } }).fig : undefined);
    if (fig?.print?.silent) {
      try {
        await fig.print.silent();
        return;
      } catch {
      }
    }
    window.print();
    return;
  }
  const fig = (typeof window !== "undefined" ? (window as unknown as { fig?: { print?: { dialog: () => Promise<unknown> } } }).fig : undefined);
  if (fig?.print?.dialog) {
    try {
      await fig.print.dialog();
      return;
    } catch {
    }
  }
  window.print();
}

export async function doPrint() {
  await doPrintWithMode(getEffectivePrintMode("dialog"));
}

export async function doPrintDialog() {
  await doPrintWithMode("dialog");
}

export async function doPrintSilent() {
  await doPrintWithMode("silent");
}
