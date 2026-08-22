"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { UpdaterIcon } from "@/components/icons";
import { UPDATE } from "@/lib/constants";

function StatusLine({
  checking,
  downloading,
  downloaded,
  available,
  error,
}: {
  checking: boolean;
  downloading: boolean;
  downloaded: boolean;
  available: string;
  error: string;
}) {
  if (error) return <span className="text-error">{error}</span>;
  if (checking) return <>{UPDATE.checking}</>;
  if (downloading) return <>{UPDATE.downloading}</>;
  if (downloaded) return <span className="text-success">{UPDATE.downloaded}</span>;
  if (available) return <span className="font-semibold text-brand-600">{UPDATE.available} — v{available}</span>;
  return <span className="text-success">{UPDATE.upToDate}</span>;
}

export function UpdateTab() {
  const { toast } = useToast();
  const isElectron = typeof window !== "undefined" && Boolean(window.fig?.isElectron);
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    if (!isElectron) return;
    let disposed = false;
    const offUpdate = window.fig?.update?.onStatus((next) => {
      if (!disposed) setState(next);
    });
    void window.fig?.update?.status().then((next) => !disposed && setState(next)).catch(() => {});
    return () => {
      disposed = true;
      offUpdate?.();
    };
  }, [isElectron]);

  const check = useCallback(async () => {
    try {
      const u = await window.fig?.update?.check();
      if (u) setState(u);
    } catch {
      toast(UPDATE.error, "error");
    }
  }, [toast]);

  const downloadApp = useCallback(async () => {
    try {
      const next = await window.fig?.update?.download();
      if (next) setState(next);
    } catch {
      toast(UPDATE.error, "error");
    }
  }, [toast]);

  if (!isElectron) {
    return (
      <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">{UPDATE.notElectron}</p>
    );
  }

  const appBusy = Boolean(state?.checking || state?.downloading);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-3xl bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <UpdaterIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">Updates</p>
            <p className="text-xs text-ink-500">Single download — full app installer only.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" loading={appBusy} disabled={appBusy} onClick={() => void check()}>
          {UPDATE.title}
        </Button>
      </div>

      <div className="rounded-3xl bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-900">{UPDATE.app}</p>
          <p className="text-xs text-ink-500">{UPDATE.current}: {state?.currentVersion ?? "…"}</p>
        </div>
        <p className="mb-3 text-xs text-ink-500">
          <StatusLine
            checking={Boolean(state?.checking)}
            downloading={Boolean(state?.downloading)}
            downloaded={Boolean(state?.downloaded)}
            available={state?.available ? state.version : ""}
            error={state?.error ?? ""}
          />
        </p>
        {state?.downloading && (
          <div className="mb-3 space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${state.progress ?? 0}%` }} />
            </div>
            <p className="text-xs text-ink-400">{state.progress ?? 0}% — {UPDATE.downloading}</p>
          </div>
        )}
        {state?.available && state.releaseNotes && (
          <div className="mb-3 max-h-48 overflow-auto rounded-2xl bg-ink-50 px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap text-ink-600">
            {state.releaseNotes}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {state?.available && !state?.downloading && !state?.downloaded && (
            <Button size="sm" onClick={() => void downloadApp()}>{UPDATE.download} — v{state.version}</Button>
          )}
          {state?.downloaded && (
            <>
              <Button size="sm" onClick={() => void window.fig?.update?.install()}>{UPDATE.install}</Button>
              <Button variant="secondary" size="sm" onClick={() => void window.fig?.update?.openChangelog()}>
                {UPDATE.changelog}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
