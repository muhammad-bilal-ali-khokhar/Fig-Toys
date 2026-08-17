"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { UpdaterIcon } from "@/components/icons";
import { ReleaseNotes } from "@/components/ui/release-notes";
import { useToast } from "@/components/ui/toast";

type RuntimeConfig = { mode: "local" | "hosted"; hostedUrl: string };
type ReportConfig = { enabled: boolean; backendUrl: string; hasSecret: boolean };

export function DesktopAppTab() {
  const { toast } = useToast();
  const isElectron = typeof window !== "undefined" && Boolean(window.fig?.isElectron);
  const isWindows = typeof window !== "undefined" && window.fig?.platform === "win32";
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<string[] | null>(null);
  const [report, setReport] = useState<ReportConfig | null>(null);
  const [savingReport, setSavingReport] = useState(false);
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [content, setContent] = useState<{
    type: "content" | "full";
    available: boolean;
    contentVersion: string;
    applied: string;
    version: string;
  } | null>(null);
  const [contentChecking, setContentChecking] = useState(false);
  const [contentApplying, setContentApplying] = useState(false);
  const [contentProgress, setContentProgress] = useState(0);

  const refreshContent = async () => {
    setContentChecking(true);
    try {
      const c = await window.fig?.content?.check();
      setContent(c ?? null);
      return c ?? null;
    } catch {
      setContent(null);
      return null;
    } finally {
      setContentChecking(false);
    }
  };

  useEffect(() => {
    if (!isElectron) return;
    void window.fig?.runtime
      ?.get()
      .then(setConfig)
      .catch(() => setConfig(null));
    void window.fig?.report
      ?.get()
      .then(setReport)
      .catch(() => setReport(null));
    void window.fig?.update
      ?.status()
      .then(setUpdate)
      .catch(() => setUpdate(null));
    void refreshContent();
    const off = window.fig?.update?.onStatus?.(setUpdate);
    const offContent = window.fig?.content?.onStatus?.((s) => {
      setContentProgress(s.progress ?? 0);
    });
    return () => {
      off?.();
      offContent?.();
    };
  }, [isElectron]);

  if (!isElectron) {
    return (
      <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
        This only applies to the desktop app. In a browser the app connects to the server configured for the
        website.
      </p>
    );
  }

  async function save() {
    if (!config) return;
    if (config.mode === "hosted" && !/^https?:\/\//.test(config.hostedUrl.trim())) {
      toast("Enter a valid URL starting with http(s)", "error");
      return;
    }
    setSaving(true);
    try {
      await window.fig?.runtime?.set({
        mode: config.mode,
        hostedUrl: config.mode === "hosted" ? config.hostedUrl.trim() : "",
      });
      toast("Saved. Restarting the app…", "success");
    } catch {
      toast("Could not save the mode", "error");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-3xl bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-ink-900">Fig POS for Mobile Phones</p>
          <p className="mt-0.5 text-xs text-ink-500">New &amp; used phones · IMEI tracking · Credit &amp; analytics</p>
        </div>
        <Button variant="secondary" onClick={() => void window.fig?.about?.open()}>
          About
        </Button>
      </div>

      <div className="rounded-3xl bg-white p-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Where the app runs from</p>
        <Dropdown
          value={config?.mode ?? "local"}
          options={[
            { value: "local", label: "Local server on this computer" },
            { value: "hosted", label: "Hosted website (URL)" },
          ]}
          onChange={(v) => setConfig((c) => ({ ...(c ?? { mode: "local", hostedUrl: "" }), mode: v as "local" | "hosted" }))}
        />
        {config?.mode === "hosted" && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Website URL</p>
            <Input
              value={config.hostedUrl}
              onChange={(e) => setConfig((c) => ({ ...(c ?? { mode: "hosted", hostedUrl: "" }), hostedUrl: e.target.value }))}
              placeholder="https://pos.example.com"
            />
          </div>
        )}
        <div className="mt-3 rounded-2xl bg-ink-50 px-3.5 py-2.5 text-xs text-ink-500">
          {config?.mode === "hosted"
            ? "The desktop app will open the hosted website and use it for everything. Your local data stays on this computer."
            : "The desktop app runs everything on this computer and keeps your data in a local file."}
        </div>
      </div>

      <Button onClick={() => void save()} loading={saving} disabled={!config}>
        Save &amp; restart app
      </Button>

      <div className="rounded-3xl bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Crash reporting</p>
        {report ? (
          <div className="space-y-3">
            <Checkbox
              checked={report.enabled}
              onChange={(v) => setReport((r) => (r ? { ...r, enabled: v } : r))}
              label="Send crash reports"
              description="When the app fails to start or crashes, a report with the error details is sent automatically. We handle everything from our side."
            />
            <Button
              variant="grey"
              size="sm"
              loading={savingReport}
              onClick={async () => {
                setSavingReport(true);
                try {
                  await window.fig?.report?.set({ enabled: report.enabled });
                  const updated = await window.fig?.report?.get();
                  if (updated) setReport(updated);
                  toast("Crash reporting updated", "success");
                } catch {
                  toast("Could not save crash reporting settings", "error");
                } finally {
                  setSavingReport(false);
                }
              }}
            >
              Save crash reporting
            </Button>
            <p className="rounded-2xl bg-ink-50 px-3.5 py-2.5 text-xs text-ink-500">
              The report is sent securely to our team and reviewed automatically. No setup needed on your side.
            </p>
          </div>
        ) : (
          <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
            Crash reporting is only available in the desktop app.
          </p>
        )}
      </div>

      <div className="rounded-3xl bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Updates</p>
        {!isWindows && (
          <p className="mb-3 rounded-2xl bg-ink-50 px-3.5 py-2.5 text-xs text-ink-500">
            Updates are only available for the Windows version of the desktop app. This build is not updated
            through this panel.
          </p>
        )}
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
            <UpdaterIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">
              Version {update?.currentVersion ?? "—"}
            </p>
            <p className="text-xs text-ink-500">
              {update?.checking
                ? "Checking for updates…"
                : content?.available
                  ? content.type === "full"
                    ? `A new version (${update?.version || content.version}) is available`
                    : `A new version (${content.version}) is available`
                  : update?.downloading
                    ? `Downloading update… ${update?.progress ?? 0}%`
                    : update?.available
                      ? `A new version (${update.version}) is available`
                      : update?.downloaded
                        ? "Update ready to install"
                        : "You're on the latest version"}
            </p>
          </div>
        </div>

        {content?.available && content.type === "content" && (
          <div className="mb-3 rounded-2xl bg-ink-50 p-3">
            <p className="text-xs text-ink-600">
              An update to the app is available and will be applied here — no need to reinstall. Your
              data and database are not affected.
            </p>
            {contentApplying && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${contentProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {update?.available && !update?.downloaded && (
          <div className="mb-3 rounded-2xl bg-ink-50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
              What's new in {update.version}
            </p>
            {update.releaseNotes ? (
              <div className="max-h-40 overflow-auto rounded-2xl bg-ink-50 p-3">
                <ReleaseNotes notes={update.releaseNotes} />
              </div>
            ) : (
              <p className="text-xs text-ink-400">No release notes provided.</p>
            )}
          </div>
        )}

        {update?.downloading && (
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${update.progress ?? 0}%` }}
            />
          </div>
        )}

        {update?.error && (
          <p className="mb-3 rounded-2xl bg-error/10 px-3.5 py-2.5 text-xs font-medium text-error">
            Could not check for updates: {update.error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="grey"
            loading={update?.checking || contentChecking}
            disabled={update?.downloading || update?.downloaded || contentApplying}
            onClick={async () => {
              try {
                const [s, c] = await Promise.all([
                  window.fig?.update?.check(),
                  refreshContent(),
                ]);
                if (s) setUpdate(s);
                if (c?.available) {
                  toast(`Update available. Version ${c.contentVersion}`, "success");
                } else if (s?.available) {
                  toast(`Update available. Version ${s.version}`, "success");
                } else {
                  toast("You're on the latest version", "success");
                }
              } catch {
                toast("Could not check for updates", "error");
              }
            }}
          >
            {update?.available || content?.available ? "Check again" : "Check for updates"}
          </Button>
          {content?.available && content.type === "content" && !contentApplying && (
            <Button
              loading={contentApplying}
              disabled={update?.checking}
              onClick={async () => {
                setContentApplying(true);
                try {
                  const applied = await window.fig?.content?.apply();
                  if (applied) {
                    toast("Update applied. Restarting…", "success");
                  } else {
                    toast("Could not apply the update", "error");
                    setContentApplying(false);
                  }
                } catch {
                  toast("Could not apply the update", "error");
                  setContentApplying(false);
                }
              }}
            >
              Download &amp; apply update
            </Button>
          )}
          {update?.available && !update?.downloaded && content?.type !== "content" && (
            <Button
              loading={update?.downloading}
              disabled={update?.checking || contentApplying}
              onClick={async () => {
                try {
                  const s = await window.fig?.update?.download();
                  if (s) setUpdate(s);
                  if (s?.downloaded) {
                    toast(`Update ${s.version} is ready to install`, "success");
                  } else if (s?.error) {
                    toast(`Download failed: ${s.error}`, "error");
                  } else {
                    toast("Downloading update…", "success");
                  }
                } catch {
                  toast("Could not start the download", "error");
                }
              }}
            >
              {update?.downloading ? "Downloading…" : "Download & update"}
            </Button>
          )}
          {update?.downloaded && (
            <Button
              onClick={() => {
                void window.fig?.update?.install();
                toast("Restarting to apply the update…", "success");
              }}
            >
              Restart &amp; update now
            </Button>
          )}
          <Button variant="ghost" onClick={() => void window.fig?.update?.openChangelog()}>
            View changelog
          </Button>
        </div>
        <p className="mt-2 rounded-2xl bg-ink-50 px-3.5 py-2.5 text-xs text-ink-500">
          App updates are downloaded and applied without reinstalling. When the app itself needs updating,
          it installs automatically when you quit. Your data is never touched.
        </p>
      </div>

      <div className="rounded-3xl bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Diagnostics / logs</p>
          <div className="flex gap-2">
            <Button variant="grey" size="sm" onClick={() => void window.fig?.logs?.open()}>
              Open logs folder
            </Button>
            <Button variant="grey" size="sm" onClick={() => void window.fig?.logs?.get().then(setLogs)}>
              {logs ? "Refresh logs" : "View logs"}
            </Button>
          </div>
        </div>
        {logs && (
          <pre className="max-h-64 overflow-auto rounded-2xl bg-ink-50 p-3 text-xs leading-relaxed text-ink-700">
            {logs.join("\n")}
          </pre>
        )}
        <p className="mt-2 rounded-2xl bg-ink-50 px-3.5 py-2.5 text-xs text-ink-500">
          If the app ever fails to start or closes, the log file explains why. Share its last lines
          when reporting a problem.
        </p>
      </div>
    </div>
  );
}