"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UPDATE } from "@/lib/constants";

const SNOOZE_KEY = "fig_update_snooze_until";
const SNOOZE_MS = 6 * 60 * 60 * 1000;

function isSnoozed(): boolean {
  try {
    const v = localStorage.getItem(SNOOZE_KEY);
    if (!v) return false;
    const until = Number(v);
    if (Number.isNaN(until)) return false;
    if (Date.now() < until) return true;
    localStorage.removeItem(SNOOZE_KEY);
    return false;
  } catch { return false; }
}

function isNewer(remote: string, local: string): boolean {
  const rp = remote.split(".").map(Number);
  const lp = local.split(".").map(Number);
  for (let i = 0; i < Math.max(rp.length, lp.length); i++) {
    const r = rp[i] || 0, l = lp[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [snoozed, setSnoozed] = useState(true);
  const [visible, setVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const refreshSnooze = useCallback(() => setSnoozed(isSnoozed()), []);

  useEffect(() => {
    refreshSnooze();
    if (!window.fig?.isElectron) return;
    let disposed = false;
    const isMac = window.fig.platform === "darwin";
    const onAuto = (next: UpdateState) => {
      console.log("[update-banner] auto-available", next.version);
      if (!disposed && !isSnoozed()) setState(next);
    };
    const offAuto = (window.fig.update as unknown as { onAutoAvailable: (cb:(s:UpdateState)=>void)=>()=>void })?.onAutoAvailable?.(onAuto);
    window.fig.update!.status().then((s) => {
      console.log("[update-banner] initial status", s);
      if (!disposed && s?.available && !isSnoozed()) setState(s);
    }).catch(() => {});
    let t: ReturnType<typeof setTimeout>;
    if (isMac) {
      t = setTimeout(async () => {
        console.log("[update-banner] auto check (mac) fetching latest.json");
        try {
          const cur = (await window.fig!.update!.status())?.currentVersion ?? "";
          const res = await fetch(`${UPDATE.downloadSite}/latest.json`, { cache: "no-store" });
          console.log("[update-banner] fetch", res.status);
          if (!res.ok) return;
          const m = await res.json();
          console.log("[update-banner] manifest", m.version, "cur", cur);
          if (m?.version && cur && isNewer(m.version, cur) && !disposed && !isSnoozed()) {
            setState((prev) => ({ ...(prev as unknown as UpdateState), available: true, version: m.version, currentVersion: cur } as UpdateState));
          } else if (m?.version && !cur && !disposed && !isSnoozed()) {
            setState((prev) => ({ ...(prev as unknown as UpdateState), available: true, version: m.version } as UpdateState));
          }
        } catch (e) { console.log("[update-banner] auto check failed", e); }
      }, 2500);
    } else {
      t = setTimeout(() => {
        console.log("[update-banner] auto check (win) invoking checkAuto");
        (window.fig?.update as unknown as { checkAuto:()=>Promise<unknown> } | undefined)?.checkAuto?.().catch((e)=>console.log("[update-banner] checkAuto failed",e));
      }, 2500);
    }
    const iv = setInterval(refreshSnooze, 60_000);
    const onStorage = (e: StorageEvent) => { if (e.key === SNOOZE_KEY) refreshSnooze(); };
    window.addEventListener("storage", onStorage);
    return () => { disposed = true; clearTimeout(t); clearInterval(iv); window.removeEventListener("storage", onStorage); offAuto?.(); };
  }, [refreshSnooze]);

  useEffect(() => {
    if (state?.available && !snoozed && !state.downloading && !(state as unknown as { installing?: boolean }).installing) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [state?.available, snoozed, state?.downloading, (state as unknown as { installing?: boolean })?.installing]);

  const onLater = useCallback(() => {
    console.log("[update-banner] snoozed for 6h");
    setVisible(false);
    setTimeout(() => {
      try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch {}
      setSnoozed(true);
    }, 300);
  }, []);

  const onUpdateNow = useCallback(async () => {
    if (!window.fig?.update) return;
    if (window.fig.platform === "darwin") {
      window.open(`${UPDATE.downloadSite}/v${state?.version}/Fig-POS-Setup-${state?.version}.exe`, "_blank");
      return;
    }
    setDownloading(true);
    try {
      if (state?.downloaded) await window.fig.update.install();
      else await window.fig.update.download();
    } catch {}
    setDownloading(false);
  }, [state?.downloaded, state?.version]);

  if (!window.fig?.isElectron) return null;
  if (!state?.available) return null;
  if (snoozed && !visible) return null;
  if (state.downloading || (state as unknown as { installing?: boolean }).installing) return null;

  const isMac = typeof window !== "undefined" && window.fig?.platform === "darwin";

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50">
      <div className={`pointer-events-auto w-[420px] rounded-[20px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.15)] transition-all duration-300 ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-lg text-white">↗</div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-ink-900">Update available — v{state.version}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">{isMac ? "Windows installer ready on download site." : "A new version is ready. Update now to get the latest features and fixes."}</p>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <Button variant="grey" onClick={onLater} className="flex-1 rounded-full">{UPDATE.later}</Button>
          <Button onClick={onUpdateNow} loading={downloading} className="flex-1 rounded-full">{isMac ? "View download" : "Update now"}</Button>
        </div>
      </div>
    </div>
  );
}
