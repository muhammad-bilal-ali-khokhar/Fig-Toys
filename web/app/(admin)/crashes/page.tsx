"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bug, Search } from "lucide-react";
import { ROUTES, TEXT } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { CrashReport } from "@/lib/types";
import { EmptyState, Input, PageHeader } from "@/components/ui";

type Filter = "all" | "new" | "resolved";

const filters: Filter[] = ["new", "all", "resolved"];

export default function CrashesPage() {
  const { db } = useStore();
  const [filter, setFilter] = useState<Filter>("new");
  const [query, setQuery] = useState("");

  const clientOf = (report: CrashReport) =>
    report.clientId
      ? db.clients.find((client) => client.id === report.clientId)
      : undefined;

  const counts = useMemo(
    () => ({
      new: db.crashReports.filter((report) => report.status === "new").length,
      resolved: db.crashReports.filter((report) => report.status === "resolved")
        .length,
      all: db.crashReports.length,
    }),
    [db.crashReports],
  );

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return db.crashReports
      .filter((report) => filter === "all" || report.status === filter)
      .filter((report) => {
        if (!term) return true;
        const client = clientOf(report);
        return [
          report.title,
          report.message,
          report.deviceId,
          report.app,
          report.version,
          client?.shopName ?? "",
          client?.ownerName ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      });
  }, [db.crashReports, db.clients, filter, query]);

  return (
    <div>
      <PageHeader title={TEXT.crashes.title} subtitle={TEXT.crashes.subtitle} />

      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((item) => {
            const active = filter === item;
            const label =
              item === "new"
                ? TEXT.crashes.new
                : item === "resolved"
                  ? TEXT.crashes.resolved
                  : TEXT.crashes.all;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-brand-600 text-white"
                    : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    active ? "bg-white/20" : "bg-white text-ink-500"
                  }`}
                >
                  {counts[item]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={TEXT.crashes.search}
            className="pl-10"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={filter === "new" ? TEXT.crashes.noNew : TEXT.crashes.empty}
          body={filter === "new" ? undefined : TEXT.crashes.subtitle}
        />
      ) : (
        <div className="table-wrap">
          <table className="table min-w-[860px]">
            <thead>
              <tr>
                <th>{TEXT.crashes.report}</th>
                <th>{TEXT.crashes.client}</th>
                <th>{TEXT.crashes.device}</th>
                <th>{TEXT.crashes.received}</th>
                <th>{TEXT.crashes.status}</th>
                <th className="text-right">{TEXT.detail.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((report) => {
                const client = clientOf(report);
                return (
                  <tr key={report.id}>
                    <td>
                      <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                        <Bug className="h-3.5 w-3.5 shrink-0 text-error" />
                        {report.title}
                      </span>
                      <span className="text-xs text-ink-500">
                        {report.app} {report.version}
                      </span>
                    </td>
                    <td>
                      {client ? (
                        <Link
                          href={ROUTES.clientDetail(client.id)}
                          className="table-link block truncate"
                        >
                          {client.shopName}
                        </Link>
                      ) : (
                        <span className="text-xs text-ink-400">
                          {TEXT.crashes.unknownClient}
                        </span>
                      )}
                      {client ? (
                        <span className="text-xs text-ink-500">
                          {client.city}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className="block max-w-[180px] truncate font-mono text-xs text-ink-600">
                        {report.deviceId}
                      </span>
                    </td>
                    <td>
                      <span className="whitespace-nowrap text-xs text-ink-600">
                        {formatDateTime(report.createdAt)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          report.status === "new"
                            ? "badge badge-trial"
                            : "badge badge-active"
                        }
                      >
                        {report.status === "new"
                          ? TEXT.crashes.new
                          : TEXT.crashes.resolved}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <Link
                          href={ROUTES.crashDetail(report.id)}
                          className="btn-secondary btn-sm"
                        >
                          {TEXT.crashes.view}
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
