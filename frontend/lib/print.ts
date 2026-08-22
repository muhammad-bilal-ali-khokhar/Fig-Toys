export async function doPrint() {
  const fig = (typeof window !== "undefined" ? (window as unknown as { fig?: { print?: { silent: () => Promise<unknown>; dialog: () => Promise<unknown> } } }).fig : undefined);
  if (fig?.print?.silent) {
    try {
      await fig.print.silent();
      return;
    } catch {
    }
  }
  window.print();
}

export async function doPrintDialog() {
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
