"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import type { AdminUser } from "@/lib/api-types";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
  type Permission,
} from "@/lib/constants/permissions";
import { ROLE_META, USER_TEXT, type Role } from "@/lib/constants/users";
import { useDirtyForm } from "@/lib/use-dirty-form";
import { DiscardConfirmDialog } from "@/components/ui/discard-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { PlusIcon, TrashIcon, UsersIcon, EyeIcon } from "@/components/icons";
import { Dialog } from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/search-input";
import { Sheet } from "@/components/ui/sheet";
import { ContextMenu } from "@/components/ui/context-menu";
import { FormWindow, FormField, FormInput } from "@/components/ui/form";
import { ImagePicker } from "@/components/products/image-picker";

const ROLE_OPTIONS: { value: Role; label: string }[] = Object.entries(ROLE_META).map(
  ([value, meta]) => ({ value: value as Role, label: meta.label }),
);

function UserForm({
  editing,
  me,
  onClose,
  onSaved,
}: {
  editing: AdminUser | null;
  me: AdminUser | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isSelf = editing?.id === me?.id;

  const [username, setUsername] = useState(editing?.username ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [avatar, setAvatar] = useState(editing?.avatar ?? "");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<Role>(editing?.role ?? "CASHIER");
  const [active, setActive] = useState(editing?.active ?? true);
  const [permissions, setPermissions] = useState<Set<string>>(
    () => new Set(editing?.permissions ?? []),
  );
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [permSection, setPermSection] = useState(PERMISSION_GROUPS[0]?.title ?? "");

  const dirty = useDirtyForm({ username, name, email, role, active, pin, permissions: [...permissions] });

  function markChanged(next: Partial<{ username: string; name: string; email: string; role: Role; active: boolean; pin: string; permissions: string[] }>) {
    const updated = {
      username, name, email, role, active, pin,
      permissions: next.permissions ?? [...permissions],
      ...next,
    };
    dirty.markDirty({ username: updated.username, name: updated.name, email: updated.email, role: updated.role, active: updated.active, pin: updated.pin, permissions: updated.permissions });
  }

  const togglePermission = (key: string) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      markChanged({ permissions: [...next] });
      return next;
    });
  };

  const toggleGroup = (groupKeys: readonly Permission[]) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      const allSelected = groupKeys.every((k) => next.has(k));
      for (const k of groupKeys) {
        if (allSelected) next.delete(k);
        else next.add(k);
      }
      markChanged({ permissions: [...next] });
      return next;
    });
  };

  const useRoleDefaults = () => {
    setPermissions(new Set(ROLE_PERMISSIONS[role]));
    markChanged({ permissions: [...ROLE_PERMISSIONS[role]] });
  };

  async function save() {
    if (!username.trim() || !name.trim()) {
      toast("Enter a username and full name", "error");
      return;
    }
    if (!editing && !/^\d{4}$/.test(pin)) {
      toast(USER_TEXT.pinRequired, "error");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name,
        email: email || undefined,
        ...(avatar ? { avatar } : {}),
      };
      if (!isSelf) {
        body.username = username;
        body.role = role;
        body.active = active;
        body.permissions = [...permissions];
        if (pin) body.pin = pin;
      }
      if (editing) {
        await apiRequest(`/user/${editing.id}`, { method: "PUT", body });
        toast(USER_TEXT.updated, "success");
      } else {
        await apiRequest("/user", { method: "POST", body });
        toast(USER_TEXT.created, "success");
      }
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save user", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormWindow
      open
      title={editing ? USER_TEXT.editUser : USER_TEXT.newUser}
      saveLabel={USER_TEXT.save}
      saving={submitting}
      width="max-w-xl"
      onClose={onClose}
      onCancel={() => dirty.requestClose(onClose)}
      onSubmit={() => void save()}
    >
      <div className="grid gap-4">
        <div className="space-y-4">
          <FormField label="Profile picture">
            <ImagePicker
              shape="square"
              value={avatar}
              onChange={(v) => { setAvatar(v); markChanged({ permissions: [...permissions] }); }}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={USER_TEXT.username}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-400">
                  @
                </span>
                <FormInput
                  value={username}
                  onChange={(e) => { const v = e.target.value.toUpperCase(); setUsername(v); markChanged({ username: v }); }}
                  placeholder={USER_TEXT.usernamePlaceholder}
                  className="pl-8 uppercase"
                  disabled={isSelf}
                />
              </div>
            </FormField>
            <FormField label={USER_TEXT.name}>
              <FormInput
                value={name}
                onChange={(e) => { setName(e.target.value); markChanged({ name: e.target.value }); }}
                placeholder={USER_TEXT.namePlaceholder}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={USER_TEXT.email}>
              <FormInput
                value={email}
                onChange={(e) => { setEmail(e.target.value); markChanged({ email: e.target.value }); }}
                placeholder={USER_TEXT.emailPlaceholder}
                type="email"
              />
            </FormField>
            {isSelf ? (
              <FormField label={USER_TEXT.pin}>
                <p className="rounded-2xl bg-ink-100 px-3.5 py-2 text-xs text-ink-500">
                  {USER_TEXT.changePinInSettings}
                </p>
              </FormField>
            ) : (
              <FormField label={USER_TEXT.pin} hint={USER_TEXT.pinHint}>
                <div className="relative">
                  <FormInput
                    value={pin}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setPin(v);
                      markChanged({ pin: v });
                    }}
                    placeholder={editing ? USER_TEXT.pinPlaceholder : ""}
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    autoComplete="new-password"
                    className="pr-10 tracking-[0.3em]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-400 transition hover:text-ink-600"
                    aria-label={showPin ? "Hide PIN" : "Show PIN"}
                  >
                    <EyeIcon className={`h-4 w-4 ${showPin ? "text-brand-600" : ""}`} />
                  </button>
                </div>
              </FormField>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={USER_TEXT.role}>
              {isSelf ? (
                <div className="rounded-2xl bg-ink-100 px-3.5 py-2 text-sm text-ink-900 opacity-60">
                  {ROLE_META[role].label}
                </div>
              ) : (
                <Dropdown value={role} options={ROLE_OPTIONS} onChange={(value) => { setRole(value); markChanged({ role: value }); }} searchable />
              )}
            </FormField>
            <FormField label={USER_TEXT.permissions}>
              {isSelf ? (
                <div className="rounded-2xl bg-ink-100 px-3.5 py-2 text-sm text-ink-900 opacity-60">
                  {permissions.size} {USER_TEXT.permissionCount}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPermissionsOpen(true)}
                  className="flex w-full items-center justify-between rounded-2xl bg-ink-100 px-3.5 py-2 text-sm text-ink-900 transition hover:bg-ink-200"
                >
                  <span>{permissions.size} {USER_TEXT.permissionCount}</span>
                  <span className="text-xs font-semibold text-brand-600">Manage →</span>
                </button>
              )}
            </FormField>
          </div>

          <div className="rounded-2xl bg-white p-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={active} onChange={(v) => { setActive(v); markChanged({ active: v }); }} disabled={isSelf} />
              <span className="text-sm font-medium text-ink-900">{USER_TEXT.active}</span>
              <span className="text-xs text-ink-400">{USER_TEXT.activeHint}</span>
            </div>
          </div>
        </div>
      </div>

      <Sheet
        open={permissionsOpen}
        title={USER_TEXT.permissions}
        onClose={() => setPermissionsOpen(false)}
        width="max-w-4xl"
        showClose={false}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-500">
              Tick a section name to give or remove all permissions in it at once.
            </p>
            {isSelf && <p className="mt-0.5 text-xs text-ink-400">{USER_TEXT.selfGuard}</p>}
          </div>
          <Button
            variant="grey"
            type="button"
            onClick={useRoleDefaults}
            title={USER_TEXT.useRoleDefaultsHint}
            className="shrink-0"
          >
            {USER_TEXT.useRoleDefaults}
          </Button>
        </div>
        <div className="flex min-h-[50vh]">
          <div className="w-44 shrink-0 overflow-y-auto overscroll-none p-1">
            {PERMISSION_GROUPS.map((group) => {
              const selected = group.keys.filter((k) => permissions.has(k)).length;
              const allSelected = selected === group.keys.length;
              const groupState: boolean | "indeterminate" =
                selected === 0 ? false : allSelected ? true : "indeterminate";
              const active = group.title === permSection;
              return (
                <button
                  key={group.title}
                  type="button"
                  onClick={() => setPermSection(group.title)}
                  className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                    active ? "bg-ink-100 text-ink-900" : "text-ink-600 hover:bg-ink-100/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    tabIndex={-1}
                    checked={groupState === true}
                    ref={(el) => {
                      if (el) el.indeterminate = groupState === "indeterminate";
                    }}
                    readOnly
                    className="h-4 w-4 shrink-0 accent-brand-600"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="min-w-0 flex-1 truncate">{group.title}</span>
                  <span className="shrink-0 text-[10px] text-ink-400">{selected}</span>
                </button>
              );
            })}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            {(() => {
              const group = PERMISSION_GROUPS.find((g) => g.title === permSection);
              if (!group) return null;
              const selected = group.keys.filter((k) => permissions.has(k)).length;
              const allSelected = selected === group.keys.length;
              const groupState: boolean | "indeterminate" =
                selected === 0 ? false : allSelected ? true : "indeterminate";
              return (
                <>
                  <div className="border-b border-ink-100 p-4 pb-2">
                    <p className="text-sm font-semibold text-ink-900">{group.title}</p>
                    <p className="text-xs text-ink-400">
                      {selected} of {group.keys.length} allowed
                    </p>
                  </div>
                  <div className="grid flex-1 gap-x-4 gap-y-1.5 overflow-y-auto overscroll-none p-4 sm:grid-cols-2">
                    {group.keys.map((key) => (
                      <Checkbox
                        key={key}
                        checked={permissions.has(key)}
                        onChange={() => togglePermission(key)}
                        label={PERMISSION_LABELS[key] ?? key}
                        disabled={isSelf && key === "user.manage"}
                      />
                    ))}
                  </div>
                  <div className="border-t border-ink-100 p-4">
                    <Checkbox
                      checked={groupState}
                      onChange={() => toggleGroup(group.keys)}
                      label={`Select all in ${group.title}`}
                    />
                  </div>
                </>
              );
            })()}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="grey" type="button" onClick={() => setPermissionsOpen(false)}>
            Done
          </Button>
        </div>
      </Sheet>

      <DiscardConfirmDialog
        open={dirty.confirmOpen}
        onConfirm={dirty.confirmDiscard}
        onCancel={dirty.cancelDiscard}
      />
    </FormWindow>
  );
}

export function UsersManager() {
  const { user } = useAuth();
  const { data: users, loading, error, refetch } = useApi<AdminUser[]>("/user");
  const { toast } = useToast();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const me = users?.find((u) => u.id === user?.id);
  const isAdmin = user?.role === "ADMIN";

  async function remove(target: AdminUser) {
    setDeleting(true);
    try {
      await apiRequest(`/user/${target.id}`, { method: "DELETE" });
      toast("User deleted", "success");
      setDeleteTarget(null);
      void refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete user", "error");
    } finally {
      setDeleting(false);
    }
  }

  const filtered = (users ?? []).filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email?.toLowerCase().includes(q) ?? false) ||
      ROLE_META[u.role].label.toLowerCase().includes(q)
    );
  });

  function closePanel() {
    setPanelOpen(false);
    setEditing(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div className="relative flex-1">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by name, username or role…"
            className="bg-white"
          />
        </div>
        <Button onClick={() => { setEditing(null); setPanelOpen(true); }}>
          <PlusIcon className="h-4 w-4" />
          {USER_TEXT.newUser}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="py-10 text-center text-sm text-ink-400">Loading users…</p>
        ) : error ? (
          <EmptyState
            title={error}
            action={
              <Button variant="grey" onClick={() => void refetch()}>
                {USER_TEXT.retry}
              </Button>
            }
          />
        ) : !users || users.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="h-10 w-10 text-ink-300" />}
            title={USER_TEXT.noData}
            action={
              <Button variant="grey" onClick={() => { setEditing(null); setPanelOpen(true); }}>
                <PlusIcon className="h-4 w-4" />
                {USER_TEXT.newUser}
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<UsersIcon className="h-10 w-10 text-ink-300" />} title="No matching users" />
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
                {u.avatar ? (
                  <img src={u.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-sm font-bold text-brand-600">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink-900">{u.name}</p>
                    <Badge variant="neutral">@{u.username}</Badge>
                    {u.system && <Badge variant="brand">System</Badge>}
                    {u.id === me?.id && <Badge variant="brand">You</Badge>}
                  </div>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                    {ROLE_META[u.role].label}
                    <span>·</span>
                    {u.permissions.length} {USER_TEXT.permissionCount}
                    <span>·</span>
                    {u.active ? (
                      <span className="text-brand-600">Active</span>
                    ) : (
                      <span className="text-ink-400">Inactive</span>
                    )}
                  </p>
                  {(u.email || u.createdAt) && (
                    <p className="mt-0.5 truncate text-[11px] text-ink-400">
                      {[u.email, u.createdAt ? `Joined ${new Date(u.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}` : null].filter(Boolean).join(" · ") || "—"}
                    </p>
                  )}
                </div>
                <ContextMenu
                  items={[
                    ...(u.system
                      ? []
                      : [{
                          label: "Edit",
                          onClick: () => {
                            setEditing(u);
                            setPanelOpen(true);
                          },
                        }]),
                    ...(!u.system && u.id !== me?.id && (u.role !== "ADMIN" || isAdmin)
                      ? [{
                          label: "Delete",
                          leading: <TrashIcon className="h-4 w-4" />,
                          danger: true,
                          onClick: () => setDeleteTarget(u),
                        }]
                      : []),
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {panelOpen && (
        <UserForm
          key={editing?.id ?? "new"}
          editing={editing}
          me={me}
          onClose={closePanel}
          onSaved={() => {
            closePanel();
            void refetch();
          }}
        />
      )}

      <Dialog
        open={deleteTarget !== null}
        title="Delete this user?"
        message={`${deleteTarget?.name ?? "This user"} will be permanently removed and can no longer sign in. This cannot be undone.`}
        confirmLabel="Delete user"
        cancelLabel="Cancel"
        destructive
        busy={deleting}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
