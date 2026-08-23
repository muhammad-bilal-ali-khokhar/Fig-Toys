"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { DownloadIcon, UpdaterIcon } from "@/components/icons";
import { DEVELOPER } from "@/lib/constants/help";
import { UPDATE } from "@/lib/constants";

function renderInline(text: string) {
  const codeSplit = text.split(/(`[^`]+`)/g);
  return codeSplit.flatMap((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return [
        <code
          key={`c-${i}`}
          className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[11px] text-ink-700"
        >
          {part.slice(1, -1)}
        </code>,
      ];
    }
    const boldSplit = part.split(/(\*\*[^*]+\*\*)/g);
    return boldSplit.map((bp, j) => {
      if (bp.startsWith("**") && bp.endsWith("**") && bp.length > 3) {
        return (
          <strong key={`b-${i}-${j}`} className="font-semibold text-ink-900">
            {bp.slice(2, -2)}
          </strong>
        );
      }
      return bp;
    });
  });
}

function ReleaseNotes({ notes }: { notes: string }) {
  const lines = notes.split("\n");
  const elements: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc space-y-1 pl-5">
          {bullets.map((b, idx) => (
            <li key={idx}>{renderInline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      flushBullets();
      continue;
    }
    if (/^#{1,3}\s/.test(trimmed)) {
      flushBullets();
      const heading = trimmed.replace(/^#{1,3}\s*/, "");
      elements.push(
        <p key={`h-${elements.length}`} className="font-semibold text-ink-900">
          {renderInline(heading)}
        </p>,
      );
    } else if (/^[-*]\s/.test(trimmed)) {
      bullets.push(trimmed.replace(/^[-*]\s*/, ""));
    } else {
      flushBullets();
      elements.push(
        <p key={`p-${elements.length}`} className="leading-relaxed">
          {renderInline(trimmed)}
        </p>,
      );
    }
  }
  flushBullets();
  return <div className="space-y-2">{elements}</div>;
}

function formatBytes(n?: number) {
  if (!n || n <= 0) return "";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function formatSpeed(bps?: number) {
  if (!bps || bps <= 0) return "";
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

function StatusLine({
  checking,
  downloading,
  downloaded,
  installing,
  available,
  error,
}: {
  checking: boolean;
  downloading: boolean;
  downloaded: boolean;
  installing: boolean;
  available: string;
  error: string;
}) {
  if (error) return <span className="text-error">{error}</span>;
  if (installing) return <span className="font-semibold text-brand-600">{UPDATE.installing}</span>;
  if (checking) return <>{UPDATE.checking}</>;
  if (downloading) return <>{UPDATE.downloading}</>;
  if (downloaded) return <span className="text-success">{UPDATE.downloaded}</span>;
  if (available) return <span className="font-semibold text-brand-600">{UPDATE.available} — v{available}</span>;
  return <span className="text-success">{UPDATE.upToDate}</span>;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function UpdateTab() {
  const { toast } = useToast();
  const isElectron = typeof window !== "undefined" && Boolean(window.fig?.isElectron);
  const [state, setState] = useState<UpdateState | null>(null);
  const [history, setHistory] = useState<{ version: string; size?: string; publishedAt?: string; description?: string; url: { setup: string } }[]>([]);

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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${UPDATE.downloadSite}/versions.json`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.versions)) setHistory(data.versions.slice(0, 5));
      } catch {}
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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
      <div className="space-y-4">
        <div className="rounded-3xl bg-white p-4">
          <p className="text-sm font-semibold text-ink-900">Updates</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-500">{UPDATE.notElectron}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`${UPDATE.downloadSite}/Fig.Mobile.POS-setup.exe`}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              <DownloadIcon className="h-4 w-4" />
              Download for Windows
            </a>
            <a
              href={UPDATE.downloadSite}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-ink-100 px-5 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-200"
            >
              Visit download site
            </a>
          </div>
          <p className="mt-3 text-xs text-ink-400">Windows 10 / 11 · 64-bit · Offline-first · ~150 MB · No account needed</p>
        </div>
        <div className="rounded-3xl bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Need help?</p>
          <p className="mt-2 text-sm text-ink-600">Contact {DEVELOPER.studio} — {DEVELOPER.phone} · {DEVELOPER.whatsapp} · {DEVELOPER.email}</p>
          <p className="mt-1 text-xs text-ink-400">Slow internet? Download may take longer — the desktop updater now waits up to 15 min and retries on timeout.</p>
        </div>
      </div>
    );
  }

  const appBusy = Boolean(state?.checking || state?.downloading || (state as unknown as { installing?: boolean })?.installing);
  const isTimeoutError = Boolean(state?.error && /timeout|Slow connection/i.test(state.error));
  const directUrl = state?.url || (state?.available ? `${UPDATE.downloadSite}/v${state.version}/Fig.Mobile.POS-setup.exe` : "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-3xl bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <UpdaterIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">Updates</p>
            <p className="text-xs text-ink-500">{UPDATE.differentialHint}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" loading={appBusy} disabled={appBusy} onClick={() => void check()}>
          {UPDATE.title}
        </Button>
      </div>

      <div className="rounded-3xl bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-900">{UPDATE.app}</p>
          <p className="text-xs text-ink-500">{UPDATE.current}: {state?.currentVersion ?? "…"}{state?.channel ? ` · ${state.channel}` : ""}</p>
        </div>
        <p className="mb-1 text-xs text-ink-400">
          {state?.platform ? `${state.platform} · ` : ""}{state?.lastCheckedAt ? `Last checked ${formatDate(state.lastCheckedAt)}` : "Not checked yet"}
          {state?.size ? ` · ${state.size}` : ""}
          {state?.publishedAt ? ` · Released ${formatDate(state.publishedAt)}` : ""}
        </p>
        <p className="mb-3 text-xs text-ink-500">
          <StatusLine
            checking={Boolean(state?.checking)}
            downloading={Boolean(state?.downloading)}
            downloaded={Boolean(state?.downloaded)}
            installing={Boolean((state as unknown as { installing?: boolean })?.installing)}
            available={state?.available ? state.version : ""}
            error={state?.error ?? ""}
          />
        </p>
        {isTimeoutError && <p className="mb-3 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-700">{UPDATE.timeoutHint}</p>}
        {state?.available && state?.size && <p className="mb-2 text-xs text-ink-500">Size {state.size} · 64-bit · Windows 10 / 11 · Differential download — only changed blocks</p>}
        {Boolean((state as unknown as { installing?: boolean })?.installing) && (
          <div className="mb-3 rounded-2xl bg-brand-50 px-3.5 py-2.5 text-xs leading-relaxed text-brand-700">
            {UPDATE.installingHint}
          </div>
        )}
        {state?.downloading && (
          <div className="mb-3 space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${state.progress ?? 0}%` }} />
            </div>
            <p className="text-xs text-ink-400">
              {state.progress ?? 0}% — {UPDATE.downloading}
              {state.bytesPerSecond ? ` · ${formatSpeed(state.bytesPerSecond)}` : ""}
              {state.transferred && state.total ? ` · ${formatBytes(state.transferred)} / ${formatBytes(state.total)}` : state.transferred ? ` · ${formatBytes(state.transferred)}` : ""}
            </p>
          </div>
        )}
        {state?.available && state?.releaseNotes && (
          <div className="mb-3 rounded-2xl bg-ink-50 px-3.5 py-3 text-sm leading-relaxed text-ink-600">
            <ReleaseNotes notes={state.releaseNotes} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {state?.available && !state?.downloading && !state?.downloaded && (
            <Button size="sm" onClick={() => void downloadApp()}>{UPDATE.download} — v{state.version}</Button>
          )}
          {state?.available && !state?.downloading && !state?.downloaded && directUrl && (
            <a href={directUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">Direct download</a>
          )}
          {state?.downloaded && (
            <>
              <Button size="sm" onClick={() => void window.fig?.update?.install()}>{UPDATE.install}</Button>
              <Button variant="secondary" size="sm" onClick={() => void window.fig?.update?.openChangelog()}>
                {UPDATE.changelog}
              </Button>
            </>
          )}
          {state?.error && (
            <Button variant="secondary" size="sm" onClick={() => void check()}>{UPDATE.retry}</Button>
          )}
          {!state?.available && !state?.error && (
            <a href={UPDATE.downloadSite} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">Open download site</a>
          )}
        </div>
        {state?.available && isTimeoutError && <p className="mt-3 text-xs text-ink-400">{UPDATE.downloadTimeoutHint} If it keeps failing, use Direct download.</p>}
      </div>

      {history.length > 0 && (
        <div className="rounded-3xl bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-900">Recent releases</p>
            <a href={UPDATE.downloadSite} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-600 hover:text-brand-700">See all</a>
          </div>
          <div className="space-y-2">
            {history.slice(0, 3).map((v) => (
              <div key={v.version} className="flex items-center justify-between gap-3 rounded-2xl border border-ink-100 px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">v{v.version} <span className="ml-2 text-xs font-normal text-ink-400">{v.publishedAt ? formatDate(v.publishedAt) : ""}{v.size ? ` · ${v.size}` : ""}</span></p>
                  {v.description && <p className="mt-1 line-clamp-1 text-xs text-ink-500">{v.description.split("\n").find((l) => l.trim().startsWith("-"))?.replace(/^\s*-\s*/, "").replace(/\*\*/g, "") || ""}</p>}
                </div>
                <a href={v.url.setup} className="shrink-0 rounded-full bg-ink-900 px-4 py-2 text-xs font-medium text-white hover:bg-ink-800">Download</a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Requirements & support</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-ink-50 px-3 py-2.5"><p className="font-semibold text-ink-900">Windows</p><p className="text-ink-500">10 / 11 · 64-bit</p></div>
          <div className="rounded-2xl bg-ink-50 px-3 py-2.5"><p className="font-semibold text-ink-900">Offline</p><p className="text-ink-500">Works fully offline</p></div>
          <div className="rounded-2xl bg-ink-50 px-3 py-2.5"><p className="font-semibold text-ink-900">Support</p><p className="text-ink-500">{DEVELOPER.whatsapp}</p></div>
          <div className="rounded-2xl bg-ink-50 px-3 py-2.5"><p className="font-semibold text-ink-900">Email</p><p className="text-ink-500">{DEVELOPER.email}</p></div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-400">Tip: if check repeatedly times out, your connection is slow — we now retry automatically (2×) and wait 30s. For installs, keep the app open while downloading (up to 15 min on slow networks).</p>
      </div>
    </div>
  );
}
