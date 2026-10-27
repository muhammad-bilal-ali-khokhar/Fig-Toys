"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  MonitorSmartphone,
} from "lucide-react";
import { ROUTES, TEXT } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { Button, EmptyState, PageHeader } from "@/components/ui";

export default function CrashDetailPage() {
  const params = useParams();
  const { db, resolveCrashReport } = useStore();
  const { toast } = useToast();
  const report = db.crashReports.find((item) => item.id === params.id);
  const client = report?.clientId
    ? db.clients.find((item) => item.id === report.clientId)
    : undefined;

  if (!report) {
    return (
      <div>
        <Link
          href={ROUTES.crashes}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {TEXT.crashes.title}
        </Link>
        <EmptyState title={TEXT.errors.notFound} />
      </div>
    );
  }

  async function resolve() {
    await resolveCrashReport(report!.id);
    toast(TEXT.crashes.resolvedToast, "success");
  }

  return (
    <div>
      <Link
        href={ROUTES.crashes}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {TEXT.crashes.title}
      </Link>

      <PageHeader
        title={report.title}
        subtitle={`${report.app} ${report.version} · ${formatDateTime(report.createdAt)}`}
        actions={
          report.status === "new" ? (
            <Button onClick={() => void resolve()}>
              <CheckCircle2 className="h-4 w-4" />
              {TEXT.crashes.resolve}
            </Button>
          ) : (
            <span className="badge badge-active">
              {TEXT.crashes.resolved}
            </span>
          )
        }
      />

      <div className="card mb-6 p-5">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {TEXT.crashes.client}
            </dt>
            <dd className="mt-1 text-sm text-ink-900">
              {client ? (
                <Link
                  href={ROUTES.clientDetail(client.id)}
                  className="link font-semibold"
                >
                  {client.shopName}
                </Link>
              ) : (
                <span className="text-ink-500">{TEXT.crashes.unknownClient}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {TEXT.crashes.deviceLabel}
            </dt>
            <dd className="mt-1 flex items-start gap-1.5 break-all font-mono text-xs text-ink-900">
              <MonitorSmartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
              {report.deviceId}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {TEXT.crashes.licenseKey}
            </dt>
            <dd className="mt-1 break-all font-mono text-xs leading-relaxed text-ink-900">
              {report.licenseKey || "-"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {TEXT.crashes.status}
            </dt>
            <dd className="mt-1 text-sm text-ink-900">
              {report.status === "new"
                ? TEXT.crashes.new
                : `${TEXT.crashes.resolved} · ${formatDateTime(report.resolvedAt)}`}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {TEXT.crashes.received}
            </dt>
            <dd className="mt-1 text-sm text-ink-900">
              {formatDateTime(report.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Platform
            </dt>
            <dd className="mt-1 text-sm text-ink-900">
              {report.platform || "-"}
            </dd>
          </div>
        </dl>
      </div>

      <section className="card mb-6 p-5">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-error" />
          <h2 className="section-title">{TEXT.crashes.message}</h2>
        </div>
        <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-ink-950 p-4 text-xs text-ink-100">
          {report.message}
        </pre>
      </section>

      {report.logTail ? (
        <section className="card p-5">
          <h2 className="section-title">{TEXT.crashes.logTail}</h2>
          <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-ink-950 p-4 text-xs text-ink-100">
            {report.logTail}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
