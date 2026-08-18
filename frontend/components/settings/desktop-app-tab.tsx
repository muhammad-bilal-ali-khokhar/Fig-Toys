"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type RuntimeConfig = { mode: "local" | "hosted"; hostedUrl: string };
type ReportConfig = { enabled: boolean; backendUrl: string; hasSecret: boolean };

export function DesktopAppTab() {
  const { toast } = useToast();
  const isElectron = typeof window !== "undefined" && Boolean(window.fig?.isElectron);
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<string[] | null>(null);
  const [report, setReport] = useState<ReportConfig | null>(null);
  const [savingReport, setSavingReport] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

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
                  await window.fig?.report?.set({
                    enabled: report.enabled,
                  });
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
            <Button
              variant="secondary"
              size="sm"
              loading={sendingReport}
              onClick={async () => {
                setSendingReport(true);
                try {
                  const result = await window.fig?.report?.send();
                  if (result?.ok) {
                    toast("Report sent. Thanks for helping us fix it.", "success");
                  } else if (result?.retryAfterMin) {
                    toast(`Please wait ${result.retryAfterMin} min before sending another report.`, "error");
                  } else {
                    toast("Could not send the report. We'll look into it.", "error");
                  }
                } catch {
                  toast("Could not send the report", "error");
                } finally {
                  setSendingReport(false);
                }
              }}
            >
              Send crash report
            </Button>
            <p className="rounded-2xl bg-ink-50 px-3.5 py-2.5 text-xs text-ink-500">
              The report is sent automatically to our team with the error details and recent log lines.
              No setup needed on your side. A report can be sent at most once every few minutes.
            </p>
          </div>
        ) : (
          <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
            Crash reporting is only available in the desktop app.
          </p>
        )}
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