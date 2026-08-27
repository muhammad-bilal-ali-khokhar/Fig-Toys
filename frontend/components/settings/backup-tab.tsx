"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { API_BASE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { PathPicker } from "@/components/ui/path-picker";
import { FormField } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

type BackupConfig = {
  enabled: boolean;
  directory: string;
  intervalHours: number;
  retention: number;
};

const INTERVALS = [
  { value: "1", label: "Every hour" },
  { value: "6", label: "Every 6 hours" },
  { value: "12", label: "Every 12 hours" },
  { value: "24", label: "Daily" },
  { value: "48", label: "Every 2 days" },
  { value: "168", label: "Weekly" },
];

const RETENTION = ["3", "7", "14", "30", "60"].map((v) => ({
  value: v,
  label: `${v} most recent`,
}));

function downloadBlob(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function BackupTab() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "restore" | "save" | null>(null);
  const [config, setConfig] = useState<BackupConfig | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<BackupConfig>("/backup/config")
      .then((cfg) => {
        if (active) setConfig(cfg);
      })
      .catch(() => {
        if (active) toast("Could not load backup settings", "error");
      });
    return () => {
      active = false;
    };
  }, []);

  function setEnabled(v: boolean) {
    setConfig((c) => (c ? { ...c, enabled: v } : c));
  }

  async function doSave() {
    if (!config) return;
    const dir = config.directory.trim();
    if (!dir) {
      toast("Choose a folder to save backups", "error");
      return;
    }
    setBusy("save");
    try {
      const saved = await apiRequest<BackupConfig>("/backup/config", {
        method: "PUT",
        body: JSON.stringify(config),
      });
      setConfig(saved);
      toast("Backup settings saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save settings", "error");
    } finally {
      setBusy(null);
    }
  }

  async function doExport() {
    setBusy("export");
    try {
      const url = `${API_BASE}/backup`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        toast(`Backup failed (${res.status})`, "error");
        return;
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(URL.createObjectURL(blob), `fig-backup-${stamp}.db`);
      toast("Backup downloaded", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Backup failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function doRestore(file: File) {
    setBusy("restore");
    try {
      const res = await fetch(`${API_BASE}/backup/restore`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      if (!res.ok) {
        let message = `Restore failed (${res.status})`;
        try {
          const body = await res.json();
          message = body.error?.message ?? message;
        } catch {
          /* keep default */
        }
        toast(message, "error");
        return;
      }
      toast("Database restored. Refresh the app.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Restore failed", "error");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onPick(file: File | null) {
    if (!file) return;
    if (file.size === 0) {
      toast("File is empty", "error");
      return;
    }
    const confirmed = window.confirm(
      "This replaces your entire database with the uploaded file. This cannot be undone. Continue?",
    );
    if (confirmed) void doRestore(file);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-ink-900">Backup</p>
        <p className="mt-1 text-xs text-ink-500">
          Download a copy of your entire database (customers, stock, sales, settings) as a single file.
          Do this regularly.
        </p>
        <Button onClick={doExport} disabled={busy !== null} className="mt-3">
          {busy === "export" ? "Exporting…" : "Download backup"}
        </Button>
      </div>

      <div className="rounded-2xl bg-warning/5 p-4 ring-1 ring-warning/20">
        <p className="text-sm font-semibold text-ink-900">Restore</p>
        <p className="mt-1 text-xs text-ink-500">
          Upload a backup file to replace the current database. This overwrites everything, so the
          app will reload after restoring.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".db,application/octet-stream"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
        <Button variant="destructive" onClick={() => fileRef.current?.click()} disabled={busy !== null} className="mt-3">
          {busy === "restore" ? "Restoring…" : "Restore from file"}
        </Button>
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
        <p className="text-sm font-semibold text-ink-900">Automatic backup</p>
        <p className="mt-1 text-xs text-ink-500">
          Save a copy of your database to a folder on this computer at regular intervals. Automatic
          backups run only while the app is open.
        </p>

        <div className="mt-4 space-y-4">
          <Checkbox
            checked={config?.enabled ?? false}
            onChange={setEnabled}
            label="Enable automatic backups"
            description="Runs one backup shortly after startup, then on the schedule below."
            disabled={!config}
          />

          <FormField label="Save to folder">
            <PathPicker
              value={config?.directory ?? ""}
              onChange={(v) => setConfig((c) => (c ? { ...c, directory: v } : c))}
              disabled={!config}
              placeholder="Backups folder on this computer"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Backup schedule">
              <Dropdown
                value={config ? String(config.intervalHours) : "24"}
                options={INTERVALS}
                onChange={(v) =>
                  setConfig((c) => (c ? { ...c, intervalHours: Number(v) } : c))
                }
                searchable
              />
            </FormField>
            <FormField label="Keep backups">
              <Dropdown
                value={config ? String(config.retention) : "14"}
                options={RETENTION}
                onChange={(v) =>
                  setConfig((c) => (c ? { ...c, retention: Number(v) } : c))
                }
                searchable
              />
            </FormField>
          </div>

          <Button onClick={doSave} disabled={!config || busy !== null}>
            {busy === "save" ? "Saving…" : "Save backup settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
