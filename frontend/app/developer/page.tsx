"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { DEV_PORTAL } from "@/lib/constants";

type Column = { name: string; type: string; pk: number; notnull: number };
type TableInfo = { name: string; rowCount: number; columns: Column[] };
type Row = Record<string, unknown>;
type TemplateInfo = { id: string; label: string; description: string; table: string; count: number };

async function devApi<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/dev-db${path}`, {
    method: options.method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!res.ok) throw new Error(payload?.error?.message ?? `Request failed (${res.status})`);
  return payload!.data as T;
}

function displayValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function DeveloperPortalPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [activeTable, setActiveTable] = useState<string>("");
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [rowsData, setRowsData] = useState<{ rows: Row[]; total: number }>({ rows: [], total: 0 });

  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<Row | null>(null);
  const [purging, setPurging] = useState(false);
  const [confirmPurgeRow, setConfirmPurgeRow] = useState<Row | null>(null);
  const [view, setView] = useState<"browser" | "purge">("browser");

  const [purgeMode, setPurgeMode] = useState<"records" | "templates">("records");
  const [purgeTable, setPurgeTable] = useState("");
  const [purgeSelectedIds, setPurgeSelectedIds] = useState<string[]>([]);
  const [purgeCandidates, setPurgeCandidates] = useState<Row[]>([]);
  const [purgeRefs, setPurgeRefs] = useState<{ table: string; column: string; strategy: "delete" | "clear" }[]>([]);
  const [purgeSearch, setPurgeSearch] = useState("");
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [templateIds, setTemplateIds] = useState<string[]>([]);

  useEffect(() => {
    if (!authed || view !== "purge") return;
    let cancelled = false;
    devApi<TemplateInfo[]>("/templates")
      .then((d) => {
        if (!cancelled) setTemplates(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authed, view]);

  useEffect(() => {
    if (!authed || view !== "purge" || !purgeTable) {
      setPurgeCandidates([]);
      return;
    }
    let cancelled = false;
    devApi<{ rows: Row[] }>(`/rows?table=${purgeTable}&page=1&pageSize=200`)
      .then((d) => {
        if (!cancelled) setPurgeCandidates(d.rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authed, view, purgeTable]);

  useEffect(() => {
    if (!authed || view !== "purge" || !purgeTable) {
      setPurgeRefs([]);
      return;
    }
    let cancelled = false;
    devApi<{ table: string; column: string; strategy: "delete" | "clear" }[]>(`/refs?table=${purgeTable}`)
      .then((d) => {
        if (!cancelled) setPurgeRefs(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authed, view, purgeTable]);

  useEffect(() => {
    setPurgeSelectedIds([]);
  }, [purgeTable]);

  const purgeColumns = useMemo(
    () => tables.find((t) => t.name === purgeTable)?.columns ?? [],
    [tables, purgeTable],
  );
  const purgePk = useMemo(() => purgeColumns.find((c) => c.pk)?.name ?? "", [purgeColumns]);
  const purgeLabelColumn = useMemo(
    () =>
      purgeColumns.find((c) => /^name$/i.test(c.name))?.name ??
      purgeColumns.find((c) => /text|char|clob/i.test(c.type))?.name ??
      purgePk,
    [purgeColumns, purgePk],
  );
  const selectedPurgeRows = useMemo(
    () => purgeCandidates.filter((r) => purgeSelectedIds.includes(String(r[purgePk]))),
    [purgeCandidates, purgeSelectedIds, purgePk],
  );

  async function handlePurgeCenter() {
    if (purgeMode === "templates") {
      if (templateIds.length === 0) return;
      setPurging(true);
      setError("");
      try {
        await devApi("/templates/run", { method: "POST", body: { ids: templateIds } });
        setTemplateIds([]);
        await Promise.all([loadRows(), loadTables()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPurging(false);
      }
      return;
    }
    if (selectedPurgeRows.length === 0 || !purgePk) return;
    setPurging(true);
    setError("");
    try {
      for (const row of selectedPurgeRows) {
        await devApi("/purge", {
          method: "POST",
          body: { table: purgeTable, pkColumn: purgePk, pkValue: row[purgePk] },
        });
      }
      setConfirmPurgeCenter(false);
      setPurgeSelectedIds([]);
      await Promise.all([loadRows(), loadTables()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPurging(false);
    }
  }

  function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-2xl bg-white px-3 text-sm text-ink-900 outline-none ring-brand-500/60 transition focus:ring-2"
      >
        {children}
      </select>
    );
  }

  const [confirmPurgeCenter, setConfirmPurgeCenter] = useState(false);

  function PurgeCenter() {
    const filtered = purgeCandidates.filter((r) =>
      purgeSearch.trim()
        ? displayValue(r[purgeLabelColumn]).toLowerCase().includes(purgeSearch.trim().toLowerCase())
        : true,
    );
    return (
      <section className="flex flex-1 flex-col overflow-y-auto p-6">
        <div className="mx-auto w-full max-w-xl space-y-5">
          <div>
            <h2 className="text-lg font-bold text-ink-900">{DEV_PORTAL.viewPurge}</h2>
            <p className="mt-1 text-sm text-ink-500">{DEV_PORTAL.confirmPurgeBody}</p>
          </div>

          <div className="flex rounded-full bg-ink-100 p-1">
            {(["records", "templates"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPurgeMode(m)}
                className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  purgeMode === m ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
                }`}
              >
                {m === "records" ? DEV_PORTAL.purgeModeRecords : DEV_PORTAL.purgeModeTemplates}
              </button>
            ))}
          </div>

          {purgeMode === "templates" ? (
            <div className="rounded-3xl border border-ink-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                {DEV_PORTAL.templatesHeading}
              </p>
              <p className="mt-1 text-sm text-ink-500">{DEV_PORTAL.templatesSub}</p>
              <div className="mt-4 space-y-2">
                {templates.map((t) => {
                  const checked = templateIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                        checked ? "border-error/40 bg-red-50/60" : "border-ink-100 hover:bg-ink-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setTemplateIds((ids) =>
                            e.target.checked ? [...ids, t.id] : ids.filter((i) => i !== t.id),
                          )
                        }
                        className="mt-0.5 h-4 w-4 accent-red-600"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink-900">{t.label}</span>
                        <span className="block text-xs text-ink-500">{t.description}</span>
                        <span className="mt-0.5 block text-xs font-medium text-brand-600">
                          {t.count} records
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <Button
                className="mt-5 w-full justify-center"
                variant="destructive"
                disabled={templateIds.length === 0}
                loading={purging}
                onClick={() => setConfirmPurgeCenter(true)}
              >
                {DEV_PORTAL.purgeRunSelected} ({templateIds.length})
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-ink-200 bg-white p-5">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {DEV_PORTAL.purgeEntityLabel}
                </label>
                <Select value={purgeTable} onChange={setPurgeTable}>
                  <option value="">Choose a type…</option>
                  {tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.rowCount})
                    </option>
                  ))}
                </Select>

                {purgeTable && (
                  <>
                    <label className="mb-1 mt-4 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {DEV_PORTAL.purgeRecordLabel}
                    </label>
                    <Input
                      variant="outline"
                      className="mb-2"
                      placeholder="Filter records…"
                      value={purgeSearch}
                      onChange={(e) => setPurgeSearch(e.target.value)}
                    />
                    <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-ink-100 p-1">
                      {filtered.map((r) => {
                        const id = String(r[purgePk]);
                        const checked = purgeSelectedIds.includes(id);
                        return (
                          <label
                            key={id}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                              checked ? "bg-red-50/70 text-ink-900" : "text-ink-700 hover:bg-ink-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setPurgeSelectedIds((ids) =>
                                  e.target.checked ? [...ids, id] : ids.filter((i) => i !== id),
                                )
                              }
                              className="h-4 w-4 accent-red-600"
                            />
                            <span className="truncate">
                              #{displayValue(r[purgePk])} · {displayValue(r[purgeLabelColumn]) || "(no name)"}
                            </span>
                          </label>
                        );
                      })}
                      {filtered.length === 0 && (
                        <p className="px-3 py-4 text-center text-xs text-ink-400">{DEV_PORTAL.emptyTable}</p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {selectedPurgeRows.length > 0 && (
                <div className="rounded-3xl border border-error/30 bg-red-50/60 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-error">
                    {DEV_PORTAL.purgeImpactTitle}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {purgeRefs.length === 0 && (
                      <li className="text-sm text-ink-600">{DEV_PORTAL.purgeImpactNone}</li>
                    )}
                    {purgeRefs.map((ref) => (
                      <li key={`${ref.table}.${ref.column}`} className="flex items-center justify-between text-sm text-ink-700">
                        <span className="font-medium">{ref.table}</span>
                        <span className={`text-xs ${ref.strategy === "delete" ? "text-error" : "text-success"}`}>
                          {ref.strategy === "delete" ? DEV_PORTAL.purgeStrategyDelete : DEV_PORTAL.purgeStrategyClear}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-5 w-full justify-center"
                    variant="destructive"
                    onClick={() => setConfirmPurgeCenter(true)}
                  >
                    {DEV_PORTAL.purgeRunSelected} ({selectedPurgeRows.length})
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    );
  }

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        await devApi<unknown>("/tables");
        if (!cancelled) setAuthed(true);
      } catch {
        if (!cancelled) setAuthed(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTables = useCallback(async () => {
    const data = await devApi<TableInfo[]>("/tables");
    setTables(data);
    setActiveTable((current) => current || data[0]?.name || "");
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadTables().catch((e) => setError(String(e)));
  }, [authed, loadTables]);

  useEffect(() => {
    setPage(1);
  }, [activeTable]);

  useEffect(() => {
    const t = setTimeout(() => setSearchText(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const activeColumns = useMemo(
    () => tables.find((t) => t.name === activeTable)?.columns ?? [],
    [tables, activeTable],
  );
  const pkColumn = useMemo(() => activeColumns.find((c) => c.pk)?.name ?? "", [activeColumns]);

  const loadRows = useCallback(async () => {
    if (!activeTable) return;
    const params = new URLSearchParams({
      table: activeTable,
      page: String(page),
      pageSize: "50",
    });
    if (searchText.trim()) params.set("q", searchText.trim());
    const data = await devApi<{ rows: Row[]; total: number }>(`/rows?${params}`);
    setRowsData(data);
  }, [activeTable, page, searchText]);

  useEffect(() => {
    if (!authed) return;
    loadRows().catch((e) => setError(String(e)));
  }, [authed, loadRows]);

  async function handleLogin() {
    setBusy(true);
    setLoginError("");
    try {
      await devApi("/login", { method: "POST", body: { password } });
      setPassword("");
      setAuthed(true);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : DEV_PORTAL.wrongPassword);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await devApi("/logout", { method: "POST" }).catch(() => undefined);
    setAuthed(false);
    setTables([]);
    setRowsData({ rows: [], total: 0 });
    setActiveTable("");
  }

  function openEdit(row: Row) {
    const next: Record<string, string> = {};
    for (const col of activeColumns) next[col.name] = displayValue(row[col.name]);
    setDraft(next);
    setEditing(row);
  }

  function openCreate() {
    const next: Record<string, string> = {};
    for (const col of activeColumns) next[col.name] = "";
    setDraft(next);
    setCreating(true);
  }

  async function handleSave() {
    if (!editing && !creating) return;
    setBusy(true);
    setError("");
    try {
      if (creating) {
        const data: Record<string, unknown> = {};
        for (const col of activeColumns) {
          if (col.pk && !draft[col.name]) continue;
          data[col.name] = draft[col.name];
        }
        await devApi("/row", { method: "POST", body: { table: activeTable, data } });
      } else {
        const changed: Record<string, unknown> = {};
        for (const col of activeColumns) {
          const before = displayValue(editing![col.name]);
          if (before !== draft[col.name]) changed[col.name] = draft[col.name];
        }
        if (Object.keys(changed).length > 0) {
          await devApi("/row", {
            method: "PUT",
            body: { table: activeTable, pkColumn, pkValue: editing![pkColumn], data: changed },
          });
        }
      }
      setEditing(null);
      setCreating(false);
      await Promise.all([loadRows(), loadTables()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirmDeleteRow) return;
    setBusy(true);
    setError("");
    try {
      await devApi("/row", {
        method: "DELETE",
        body: { table: activeTable, pkColumn, pkValue: confirmDeleteRow[pkColumn] },
      });
      setConfirmDeleteRow(null);
      await Promise.all([loadRows(), loadTables()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handlePurge() {
    if (!confirmPurgeRow) return;
    setPurging(true);
    setError("");
    try {
      await devApi("/purge", {
        method: "POST",
        body: { table: activeTable, pkColumn, pkValue: confirmPurgeRow[pkColumn] },
      });
      setConfirmPurgeRow(null);
      await Promise.all([loadRows(), loadTables()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPurging(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(rowsData.total / 50));

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-50 text-sm text-ink-500">
        Loading…
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-ink-900">{DEV_PORTAL.title}</h1>
          <p className="mt-1 text-sm text-ink-500">{DEV_PORTAL.subtitle}</p>
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) handleLogin();
            }}
          >
            <Input
              type="password"
              value={password}
              placeholder={DEV_PORTAL.passwordPlaceholder}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {loginError && <p className="text-sm text-error">{loginError}</p>}
            <Button type="submit" className="w-full justify-center" loading={busy}>
              {DEV_PORTAL.unlock}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-ink-50">
      <header className="flex items-center justify-between border-b border-ink-200 bg-white px-5 py-3">
        <div>
          <h1 className="text-base font-bold text-ink-900">{DEV_PORTAL.title}</h1>
          <p className="text-xs text-ink-500">{DEV_PORTAL.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-ink-100 p-1">
            {(["browser", "purge"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  view === v ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
                }`}
              >
                {v === "browser" ? DEV_PORTAL.viewBrowser : DEV_PORTAL.viewPurge}
              </button>
            ))}
          </div>
          <Button variant="grey" size="sm" onClick={handleLogout}>
            {DEV_PORTAL.lock}
          </Button>
        </div>
      </header>

      {view === "purge" ? (
        <PurgeCenter />
      ) : (
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 shrink-0 space-y-1 overflow-y-auto border-r border-ink-200 bg-white p-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            {DEV_PORTAL.tablesHeading}
          </p>
          {tables.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => setActiveTable(t.name)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                t.name === activeTable
                  ? "bg-brand-600 text-white"
                  : "text-ink-700 hover:bg-ink-100"
              }`}
            >
              <span className="truncate">{t.name}</span>
              <span className={`ml-2 shrink-0 text-xs ${t.name === activeTable ? "text-brand-100" : "text-ink-400"}`}>
                {t.rowCount}
              </span>
            </button>
          ))}
        </aside>

        <section className="flex flex-1 flex-col overflow-hidden p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              variant="white"
              className="w-64 bg-white"
              placeholder={DEV_PORTAL.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex-1" />
            <span className="text-xs text-ink-400">{rowsData.total} rows</span>
            <Button size="sm" onClick={openCreate} disabled={!pkColumn}>
              {DEV_PORTAL.newRow}
            </Button>
          </div>

          {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-error">{error}</p>}

          <div className="mt-3 flex-1 overflow-auto rounded-2xl border border-ink-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-ink-50">
                <tr>
                  {activeColumns.map((c) => (
                    <th key={c.name} className="whitespace-nowrap px-3 py-2 font-semibold text-ink-500">
                      {c.name}
                      {c.pk ? " 🔑" : ""}
                    </th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rowsData.rows.map((row, i) => (
                  <tr key={i} className="border-t border-ink-100 hover:bg-brand-50/40">
                    {activeColumns.map((c) => (
                      <td key={c.name} className="max-w-[16rem] truncate px-3 py-1.5 text-ink-700">
                        {displayValue(row[c.name])}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-1.5 text-right">
                      <button
                        type="button"
                        className="mr-2 font-medium text-brand-600 hover:underline"
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="mr-2 font-medium text-error hover:underline"
                        onClick={() => setConfirmDeleteRow(row)}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="font-medium text-error underline decoration-wavy hover:opacity-70"
                        onClick={() => setConfirmPurgeRow(row)}
                      >
                        {DEV_PORTAL.purge}
                      </button>
                    </td>
                  </tr>
                ))}
                {rowsData.rows.length === 0 && (
                  <tr>
                    <td colSpan={activeColumns.length + 1} className="px-3 py-8 text-center text-ink-400">
                      {DEV_PORTAL.emptyTable}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-ink-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="grey" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {DEV_PORTAL.prev}
              </Button>
              <Button
                variant="grey"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {DEV_PORTAL.next}
              </Button>
            </div>
          </div>
        </section>
      </div>
      )}

      {(editing || creating) && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink-900/40 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5">
            <h3 className="text-lg font-bold text-ink-900">
              {creating ? DEV_PORTAL.newRow : `${activeTable}: edit row`}
            </h3>
            <div className="mt-4 space-y-2">
              {activeColumns.map((c) => (
                <label key={c.name} className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-500">
                    {c.name}
                    {c.pk ? " · key" : ""}
                    {!c.notnull ? " · nullable" : ""}
                    {c.type ? ` · ${c.type}` : ""}
                  </span>
                  <Input
                    variant="outline"
                    value={draft[c.name] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [c.name]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="grey" onClick={() => { setEditing(null); setCreating(false); }}>
                {DEV_PORTAL.cancel}
              </Button>
              <Button loading={busy} onClick={handleSave}>
                {DEV_PORTAL.save}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={confirmDeleteRow !== null}
        title={DEV_PORTAL.confirmDeleteTitle}
        message={DEV_PORTAL.confirmDeleteBody}
        confirmLabel={DEV_PORTAL.delete}
        destructive
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteRow(null)}
      />

      <Dialog
        open={confirmPurgeCenter}
        title={DEV_PORTAL.confirmPurgeTitle}
        message={
          <span>
            {purgeMode === "templates"
              ? `${DEV_PORTAL.templatesSub} ${templateIds.length} template(s) selected.`
              : `${selectedPurgeRows.length} record(s) from ${purgeTable}.`}
            <br />
            <br />
            {DEV_PORTAL.confirmPurgeBody}
          </span>
        }
        confirmLabel={`${DEV_PORTAL.purge} everything`}
        destructive
        busy={purging}
        onConfirm={handlePurgeCenter}
        onCancel={() => setConfirmPurgeCenter(false)}
      />

      <Dialog
        open={confirmPurgeRow !== null}
        title={DEV_PORTAL.confirmPurgeTitle}
        message={
          <span>
            {DEV_PORTAL.confirmPurgeBody}
            <br />
            <br />
            <strong className="text-ink-900">
              {activeTable} · pk {pkColumn} ={" "}
              {confirmPurgeRow ? displayValue(confirmPurgeRow[pkColumn]) : ""}
            </strong>
          </span>
        }
        confirmLabel={`${DEV_PORTAL.purge} everything`}
        destructive
        busy={purging}
        onConfirm={handlePurge}
        onCancel={() => setConfirmPurgeRow(null)}
      />
    </main>
  );
}
