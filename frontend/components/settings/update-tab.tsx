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
  const [content, setContent] = useState<ContentState | null>(null);

  useEffect(() => {
    if (!isElectron) return;
    let disposed = false;
    const offUpdate = window.fig?.update?.onStatus((next) => {
      if (!disposed) setState(next);
    });
    const offContent = window.fig?.content?.onStatus((next) => {
      if (!disposed) setContent(next);
    });
    void window.fig?.update?.status().then((next) => !disposed && setState(next)).catch(() => {});
    void window.fig?.content?.status().then((next) => !disposed && setContent(next)).catch(() => {});
    return () => {
      disposed = true;
      offUpdate?.();
      offContent?.();
    };
  }, [isElectron]);

  const checkAll = useCallback(async () => {
    try {
      const [u, c] = await Promise.all([window.fig?.update?.check(), window.fig?.content?.check()]);
      if (u) setState(u);
      if (c) setContent(c);
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

  const contentNeedsRestart = Boolean(content?.backend?.status === "done" || content?.frontend?.status === "done");
  const contentBusy = Boolean(content?.checking || content?.backend?.status === "downloading" || content?.frontend?.status === "downloading");
  const appBusy = Boolean(state?.checking || state?.downloading);
  const anyAvailable = Boolean(content?.backend?.available || content?.frontend?.available);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-3xl bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <UpdaterIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">Updates</p>
            <p className="text-xs text-ink-500">{content?.base}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" loading={appBusy || contentBusy} disabled={appBusy || contentBusy} onClick={() => void checkAll()}>
          {UPDATE.title}
        </Button>
      </div>

      {contentNeedsRestart && (
        <div className="rounded-2xl bg-warning/10 px-3.5 py-2.5 text-xs text-warning">
          {UPDATE.restartToApply}
        </div>
      )}

      {/* App (shell) */}
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
        {state?.downloading && (state.progress ?? 0) > 0 && (
          <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${state.progress}%` }} />
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

      {/* Frontend + backend content */}
      {(["frontend", "backend"] as const).map((kind) => {
        const part = content?.[kind];
        const busy = part?.status === "downloading";
        const available = part?.available && part.available !== part?.version ? part.available : "";
        const error = part?.status === "error" ? part.error : "";
        return (
          <div key={kind} className="rounded-3xl bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink-900">{UPDATE[kind]}</p>
              <p className="text-xs text-ink-500">{UPDATE.current}: {part?.version ?? "…"}</p>
            </div>
            <p className="mb-3 text-xs text-ink-500">
              <StatusLine
                checking={Boolean(content?.checking)}
                downloading={busy}
                downloaded={Boolean(part?.status === "done")}
                available={available}
                error={error}
              />
            </p>
            {busy && (part?.progress ?? 0) > 0 && (
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${part.progress}%` }} />
              </div>
            )}
          </div>
        );
      })}

      {anyAvailable && !contentBusy && (
        <Button onClick={() => void window.fig?.content?.apply()}>{UPDATE.updateAll}</Button>
      )}
    </div>
  );
}