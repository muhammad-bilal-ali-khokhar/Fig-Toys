"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OtpInput } from "@/components/auth/otp-input";
import { Logo } from "@/components/brand/logo";
import { LockIcon, TrashIcon, UserIcon, UsersIcon } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { useSetupStatus } from "@/lib/use-setup";
import { useLicenseStatus } from "@/lib/use-license";
import type { CompanyProfile } from "@/lib/api-types";
import { AUTH, APP, PIN_LENGTH } from "@/lib/constants";

const MAX_REMEMBERED = 5;

export default function LoginPage() {
  const { user, status, login } = useAuth();
  const { data: profile } = useApi<CompanyProfile>("/settings/company");
  const { needsSetup, loading: setupLoading } = useSetupStatus();
  const { license, loading: licenseLoading } = useLicenseStatus();
  const { toast } = useToast();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remembered, setRemembered] = useState<string[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = profile?.name?.trim() ? profile.name : APP.nameFull;
  }, [profile]);

  useEffect(() => {
    if (status === "ready" && user) {
      router.replace("/dashboard");
    } else if (status === "ready" && setupLoading === false && needsSetup) {
      router.replace("/onboarding");
    } else if (status === "ready" && licenseLoading === false && license && license.status !== "ACTIVE") {
      router.replace("/activate");
    }
  }, [status, user, needsSetup, setupLoading, license, licenseLoading, router]);

  useEffect(() => {
    const raw = localStorage.getItem(AUTH.rememberedUsersKey);
    if (!raw) return;
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        setRemembered(list.filter((n) => typeof n === "string").slice(0, MAX_REMEMBERED));
      }
    } catch {
      localStorage.removeItem(AUTH.rememberedUsersKey);
    }
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (usernameRef.current && !usernameRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function rememberUser(name: string) {
    const nameKey = name.trim().toUpperCase();
    setRemembered((prev) => {
      const next = [nameKey, ...prev.filter((u) => u !== nameKey)].slice(0, MAX_REMEMBERED);
      localStorage.setItem(AUTH.rememberedUsersKey, JSON.stringify(next));
      return next;
    });
  }

  function selectUser(name: string) {
    setUsername(name.toUpperCase());
    setShowMenu(false);
    pinRef.current?.focus();
  }

  function clearRemembered() {
    setRemembered([]);
    localStorage.removeItem(AUTH.rememberedUsersKey);
    toast(AUTH.removedAll, "success");
  }

  async function submit(nextPin: string) {
    if (!username.trim()) {
      toast(AUTH.userRequired, "error");
      setPin("");
      return;
    }
    if (nextPin.length < PIN_LENGTH) return;
    setSubmitting(true);
    try {
      const authUser = await login(username, nextPin);
      rememberUser(authUser.username);
      setPin("");
      setSubmitting(false);
      toast(`${AUTH.loginSuccess}, ${authUser.name}!`, "success");
      router.replace("/dashboard");
    } catch (err) {
      const isRateLimited =
        err instanceof Error && err.message.toLowerCase().includes("try again in");
      toast(
        err instanceof Error ? err.message : AUTH.invalidPin,
        "error",
        isRateLimited ? 8000 : undefined,
      );
      setPin("");
      setSubmitting(false);
    }
  }

  function handleOtpChange(next: string) {
    setPin(next);
    if (next.length === PIN_LENGTH) {
      submit(next);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-brand-50 via-ink-50 to-ink-50">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-100 blur-3xl"
        aria-hidden
      />

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="relative w-full max-w-md">
          <div className="rounded-[2.5rem] bg-white p-8">
            <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-ink-400">
              {AUTH.title}
            </h2>

            <form
              className="mt-6 space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                submit(pin);
              }}
            >
              <div ref={usernameRef} className="relative">
                <label className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
                  <UserIcon className="h-3.5 w-3.5 text-ink-400" />
                  {AUTH.username}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-400">
                    @
                  </span>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toUpperCase())}
                    onFocus={() => setShowMenu(true)}
                    placeholder={AUTH.usernamePlaceholder}
                    autoComplete="off"
                    name=""
                    data-1p-ignore
                    data-lpignore="true"
                    data-form-type="other"
                    disabled={submitting}
                    className="pl-9 uppercase"
                  />
                </div>
                {showMenu && remembered.length > 0 && (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                        {AUTH.rememberedTitle}
                      </span>
                      <button
                        type="button"
                        onClick={clearRemembered}
                        className="flex items-center gap-1 text-xs font-medium text-ink-400 transition hover:text-ink-600"
                      >
                        <TrashIcon className="h-3 w-3" />
                        {AUTH.removeAll}
                      </button>
                    </div>
                    <ul>
                      {remembered.map((name) => (
                        <li key={name}>
                          <button
                            type="button"
                            onClick={() => selectUser(name)}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 transition hover:bg-ink-50"
                          >
                            <UsersIcon className="h-4 w-4 text-brand-500" />
                            {name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
                  <LockIcon className="h-3.5 w-3.5 text-ink-400" />
                  {AUTH.enterPin}
                </label>
                <OtpInput
                  length={PIN_LENGTH}
                  value={pin}
                  onChange={handleOtpChange}
                  disabled={submitting}
                  inputRef={pinRef}
                />
              </div>

            </form>
        </div>
      </div>
      </div>

      <footer className="relative z-10 flex flex-col items-center gap-2 px-4 pb-8">
        <div className="flex max-w-full items-center gap-2">
          <Logo size={20} src={profile?.logoUrl} />
          <p className="max-w-[16rem] truncate text-sm font-bold tracking-tight text-ink-900" title={profile?.name ?? APP.nameFull}>
            {profile?.name ?? APP.nameFull}
          </p>
        </div>
        <p className="max-w-sm truncate text-xs text-ink-400" title={profile?.tagline ?? APP.tagline}>{profile?.tagline ?? APP.tagline}</p>
        <p className="text-[10px] font-semibold text-brand-600">{APP.devMarker}</p>
      </footer>
    </main>
  );
}
