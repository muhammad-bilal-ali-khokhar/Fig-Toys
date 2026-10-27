"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { TEXT } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { AdminUser, AdminUserRole } from "@/lib/types";
import { Dropdown } from "@/components/dropdown";
import { Button, EmptyState, Field, Input, Modal, PageHeader } from "@/components/ui";

const roles: { value: AdminUserRole; label: string }[] = [
  { value: "owner", label: TEXT.users.owner },
  { value: "admin", label: TEXT.users.admin },
  { value: "support", label: TEXT.users.support },
];

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data && typeof data.error === "string" ? data.error : "The request failed.",
    );
  }
  return data as T;
}

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const [currentRole, setCurrentRole] = useState<AdminUserRole>("support");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminUserRole>("admin");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState("");

  const canManage = currentRole === "owner" || currentRole === "admin";
  const roleOptions =
    currentRole === "owner"
      ? roles
      : roles.filter((item) => item.value !== "owner");
  const ownerCount = useMemo(
    () => users.filter((user) => user.role === "owner" && !user.disabled).length,
    [users],
  );

  const load = useCallback(async () => {
    try {
      const data = await request<{
        users: AdminUser[];
        currentEmail: string;
        currentRole: AdminUserRole;
      }>("/api/admin/users");
      setUsers(data.users);
      setCurrentEmail(data.currentEmail);
      setCurrentRole(data.currentRole);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : TEXT.users.loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setName("");
    setEmail("");
    setRole("admin");
    setPassword("");
    setConfirm("");
    setError("");
    setCreateOpen(true);
  }

  function openEdit(user: AdminUser) {
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setDisabled(user.disabled);
    setError("");
    setEditTarget(user);
  }

  function openReset(user: AdminUser) {
    setPassword("");
    setConfirm("");
    setError("");
    setResetTarget(user);
  }

  async function createUser() {
    if (!name.trim() || !email.trim() || password.length < 8) {
      setError(TEXT.users.invalid);
      return;
    }
    if (password !== confirm) {
      setError(TEXT.users.passwordMismatch);
      return;
    }
    setBusy(true);
    try {
      await request("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name, email, role, password }),
      });
      setCreateOpen(false);
      toast(TEXT.users.createdToast, "success");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : TEXT.users.invalid);
    } finally {
      setBusy(false);
    }
  }

  async function updateUser() {
    if (!editTarget) return;
    setBusy(true);
    try {
      await request(`/api/admin/users/${editTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, email, role, disabled }),
      });
      setEditTarget(null);
      toast(TEXT.users.updatedToast, "success");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : TEXT.users.invalid);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!resetTarget || password.length < 8) {
      setError(TEXT.users.passwordHint);
      return;
    }
    if (password !== confirm) {
      setError(TEXT.users.passwordMismatch);
      return;
    }
    setBusy(true);
    try {
      await request(`/api/admin/users/${resetTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      });
      setResetTarget(null);
      toast(TEXT.users.passwordToast, "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : TEXT.users.invalid);
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await request(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      toast(TEXT.users.deletedToast, "success");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : TEXT.users.invalid);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={TEXT.users.title}
        subtitle={TEXT.users.subtitle}
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <UserPlus className="h-4 w-4" />
              {TEXT.users.add}
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="card p-6 text-sm text-ink-500">Loading users…</p>
      ) : users.length === 0 ? (
        <EmptyState title={TEXT.users.empty} />
      ) : (
        <div className="table-wrap">
          <table className="table min-w-[820px]">
            <thead>
              <tr>
                <th>User</th>
                <th>{TEXT.users.role}</th>
                <th>{TEXT.users.status}</th>
                <th>{TEXT.users.lastLogin}</th>
                <th>{TEXT.users.created}</th>
                <th className="text-right">{TEXT.users.actions}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const self = user.email === currentEmail;
                return (
                  <tr key={user.id}>
                    <td>
                      <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                        <Users className="h-4 w-4 text-ink-400" />
                        {user.name}
                        {self ? (
                          <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                            {TEXT.users.you}
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-ink-500">
                        {user.email}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          user.role === "owner"
                            ? "badge badge-active"
                            : user.role === "admin"
                              ? "badge badge-trial"
                              : "badge"
                        }
                      >
                        {user.role === "owner"
                          ? TEXT.users.owner
                          : user.role === "admin"
                            ? TEXT.users.admin
                            : TEXT.users.support}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          user.disabled ? "badge badge-blocked" : "badge badge-active"
                        }
                      >
                        {user.disabled
                          ? TEXT.users.disabled
                          : TEXT.users.active}
                      </span>
                    </td>
                    <td>
                      <span className="whitespace-nowrap text-xs text-ink-500">
                        {user.lastLoginAt
                          ? formatDateTime(user.lastLoginAt)
                          : "—"}
                      </span>
                    </td>
                    <td>
                      <span className="whitespace-nowrap text-xs text-ink-500">
                        {formatDateTime(user.createdAt)}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            !canManage ||
                            (user.role === "owner" && currentRole !== "owner")
                          }
                          onClick={() => openEdit(user)}
                        >
                          {TEXT.users.edit}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            !canManage ||
                            (user.role === "owner" && currentRole !== "owner")
                          }
                          onClick={() => openReset(user)}
                        >
                          {TEXT.users.resetPassword}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            !canManage ||
                            self ||
                            (user.role === "owner" &&
                              (currentRole !== "owner" || ownerCount <= 1))
                          }
                          onClick={() => setDeleteTarget(user)}
                          className="text-error"
                        >
                          {TEXT.users.delete}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={TEXT.users.add}
        description={TEXT.users.subtitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              {TEXT.common.cancel}
            </Button>
            <Button disabled={busy} onClick={() => void createUser()}>
              {TEXT.users.create}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={TEXT.users.name} htmlFor="user-name">
            <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={TEXT.users.email} htmlFor="user-email">
            <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <div>
            <p className="label">{TEXT.users.role}</p>
            <Dropdown
              className="w-full"
              value={role}
              options={roleOptions}
              onChange={(value) => setRole(value as AdminUserRole)}
              ariaLabel={TEXT.users.role}
            />
          </div>
          <Field label={TEXT.users.password} htmlFor="user-password">
            <Input id="user-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label={TEXT.users.confirmPassword} htmlFor="user-confirm">
            <Input id="user-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <p className="text-xs text-ink-500">{TEXT.users.passwordHint}</p>
          {error ? <p className="text-sm text-error">{error}</p> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={TEXT.users.edit}
        description={editTarget?.email}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>
              {TEXT.common.cancel}
            </Button>
            <Button disabled={busy} onClick={() => void updateUser()}>
              {TEXT.users.save}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={TEXT.users.name} htmlFor="edit-name">
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={TEXT.users.email} htmlFor="edit-email">
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <div>
            <p className="label">{TEXT.users.role}</p>
            <Dropdown
              className="w-full"
              value={role}
              options={roleOptions}
              onChange={(value) => setRole(value as AdminUserRole)}
              ariaLabel={TEXT.users.role}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={!disabled}
              disabled={editTarget?.email === currentEmail}
              onChange={(e) => setDisabled(!e.target.checked)}
            />
            {disabled ? TEXT.users.disabled : TEXT.users.active}
          </label>
          {error ? <p className="text-sm text-error">{error}</p> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={TEXT.users.resetTitle}
        description={TEXT.users.resetBody}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>
              {TEXT.common.cancel}
            </Button>
            <Button disabled={busy} onClick={() => void resetPassword()}>
              {TEXT.users.resetPassword}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={TEXT.users.password} htmlFor="reset-password">
            <Input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label={TEXT.users.confirmPassword} htmlFor="reset-confirm">
            <Input id="reset-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <p className="text-xs text-ink-500">{TEXT.users.passwordHint}</p>
          {error ? <p className="text-sm text-error">{error}</p> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={TEXT.users.deleteTitle}
        description={TEXT.users.deleteBody}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {TEXT.common.cancel}
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void deleteUser()}>
              {TEXT.users.delete}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          {deleteTarget?.name} · {deleteTarget?.email}
        </p>
        {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
      </Modal>
    </div>
  );
}
