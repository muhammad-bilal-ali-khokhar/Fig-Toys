"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, GitBranch, PackageOpen, Rocket } from "lucide-react";
import { TEXT } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { ReleaseInfo } from "@/lib/types";
import { Button, EmptyState, Input, Modal, PageHeader } from "@/components/ui";

type Feed = {
  versions: ReleaseInfo[];
  canTrigger: boolean;
  configured: boolean;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data && typeof data.error === "string" ? data.error : TEXT.releases.error,
    );
  }
  return data as T;
}

function Notes({ text }: { text: string }) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = lines.filter((line) => line.startsWith("-"));
  if (!bullets.length) {
    return <p className="whitespace-pre-wrap text-sm text-ink-600">{text}</p>;
  }
  return (
    <ul className="space-y-1.5 text-sm text-ink-600">
      {bullets.map((line, index) => (
        <li key={index} className="flex gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
          <span>{line.replace(/^-+\s*/, "").replace(/\*\*/g, "")}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ReleasesPage() {
  const { toast } = useToast();
  const [versions, setVersions] = useState<ReleaseInfo[]>([]);
  const [canTrigger, setCanTrigger] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [triggerError, setTriggerError] = useState("");
  const [runUrl, setRunUrl] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await request<Feed>("/api/admin/releases");
      setVersions(data.versions);
      setCanTrigger(data.canTrigger);
      setConfigured(data.configured);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : TEXT.releases.error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startRelease() {
    setBusy(true);
    setTriggerError("");
    try {
      const data = await request<{ runUrl: string }>("/api/admin/releases", {
        method: "POST",
        body: JSON.stringify({ version }),
      });
      setRunUrl(data.runUrl);
      setOpen(false);
      setVersion("");
      toast(TEXT.releases.started, "success");
    } catch (err) {
      setTriggerError(
        err instanceof Error ? err.message : TEXT.releases.error,
      );
    } finally {
      setBusy(false);
    }
  }

  const latest = versions[0];

  return (
    <div>
      <PageHeader
        title={TEXT.releases.title}
        subtitle={TEXT.releases.subtitle}
        actions={
          canTrigger ? (
            <Button onClick={() => setOpen(true)}>
              <Rocket className="h-4 w-4" />
              {TEXT.releases.start}
            </Button>
          ) : undefined
        }
      />

      {!configured && canTrigger ? (
        <div className="mb-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {TEXT.releases.notConfigured}
        </div>
      ) : null}

      {runUrl ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
          <span>{TEXT.releases.started}</span>
          <a
            className="font-semibold underline"
            href={runUrl}
            target="_blank"
            rel="noreferrer"
          >
            {TEXT.releases.viewRuns}
          </a>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="card p-6 text-sm text-ink-500">Loading releases…</p>
      ) : !latest ? (
        <EmptyState title={TEXT.releases.empty} />
      ) : (
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <div className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 px-6 py-6 text-white">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    <PackageOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-200">
                      {TEXT.releases.latest}
                    </p>
                    <p className="mt-1 text-3xl font-black tracking-tight">
                      v{latest.version}
                    </p>
                    <p className="mt-1 text-xs text-brand-100">
                      {latest.publishedAt
                        ? `${TEXT.releases.published}: ${formatDateTime(latest.publishedAt)}`
                        : ""}
                      {latest.size ? ` · ${latest.size}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {latest.url.setup ? (
                    <a
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-900 transition hover:bg-brand-50"
                      href={latest.url.setup}
                      download
                    >
                      <Download className="h-4 w-4" />
                      {TEXT.releases.download}
                    </a>
                  ) : null}
                  {latest.url.blockmap ? (
                    <a
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                      href={latest.url.blockmap}
                      download
                    >
                      {TEXT.releases.blockmap}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
            {latest.description ? (
              <div className="px-6 py-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {TEXT.releases.notes}
                </p>
                <Notes text={latest.description} />
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="section-title">{TEXT.releases.history}</h2>
            {versions.slice(1).map((release) => (
              <div
                key={release.version}
                className="card flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="text-sm font-bold text-ink-900">
                    v{release.version}
                  </p>
                  <p className="text-xs text-ink-500">
                    {release.publishedAt
                      ? formatDateTime(release.publishedAt)
                      : ""}
                    {release.size ? ` · ${release.size}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {release.url.setup ? (
                    <a
                      href={release.url.setup}
                      download
                      className="btn-secondary btn-sm inline-flex items-center gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {TEXT.releases.download}
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={TEXT.releases.confirmTitle}
        description={TEXT.releases.confirmBody}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {TEXT.releases.cancel}
            </Button>
            <Button
              disabled={busy || !configured}
              onClick={() => void startRelease()}
            >
              <GitBranch className="h-4 w-4" />
              {busy ? TEXT.releases.triggering : TEXT.releases.trigger}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="label" htmlFor="release-version">
            {TEXT.releases.version}
          </label>
          <Input
            id="release-version"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder={TEXT.releases.versionPlaceholder}
          />
          <p className="text-xs text-ink-500">{TEXT.releases.startHint}</p>
          {!configured ? (
            <p className="text-xs text-amber-800">{TEXT.releases.notConfigured}</p>
          ) : null}
          {triggerError ? (
            <p className="text-sm text-error">{triggerError}</p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
