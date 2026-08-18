"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import { useSetupStatus } from "@/lib/use-setup";
import { useLicenseStatus } from "@/lib/use-license";
import { APP, LICENSE } from "@/lib/constants";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardIcon } from "@/components/icons";
import { useClipboardPaste } from "@/lib/use-clipboard-paste";
import { useToast } from "@/components/ui/toast";

export default function ActivatePage() {
  const { user, status } = useAuth();
  const { needsSetup, loading: setupLoading } = useSetupStatus();
  const { license, loading, refetch } = useLicenseStatus();
  const { toast } = useToast();
  const router = useRouter();
  const [key, setKey] = useState("");
  const [activating, setActivating] = useState(false);
  const { reading: readingClipboard, paste: pasteClipboard } = useClipboardPaste();

  useEffect(() => {
    if (status !== "ready" || loading) return;
    if (needsSetup) {
      router.replace("/onboarding");
    } else if (license?.status === "ACTIVE") {
      router.replace(user ? "/dashboard" : "/login");
    }
  }, [status, license, needsSetup, loading, user, router]);

  if (status === "loading" || setupLoading || loading) {
    return <Shell>Loading…</Shell>;
  }

  if (needsSetup) {
    return <Shell>Loading…</Shell>;
  }

  async function activate() {
    const trimmed = key.trim();
    if (!trimmed) {
      toast("Enter a license key", "error");
      return;
    }
    setActivating(true);
    try {
      const updated = await apiRequest<typeof license>("/license/activate", {
        method: "POST",
        body: { key: trimmed },
      });
      toast("License activated", "success");
      refetch();
      setKey("");
      router.replace(user ? "/dashboard" : "/login");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not activate the license", "error");
    } finally {
      setActivating(false);
    }
  }

  return (
    <Shell>
      <div className="rounded-[2.5rem] bg-white p-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <Logo size={28} />
          <h2 className="text-sm font-bold tracking-tight text-ink-900">{APP.nameFull}</h2>
        </div>
        <h1 className="mt-6 text-lg font-bold text-ink-900">{LICENSE.title}</h1>
        <p className="mt-1 text-xs text-ink-500">{LICENSE.subtitle}</p>

        <div className="mt-6 text-left">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500">
            {LICENSE.keyLabel}
          </label>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={LICENSE.keyPlaceholder}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <div className="mt-3 flex gap-2">
            <Button
              variant="grey"
              className="flex-1"
              disabled={readingClipboard}
              onClick={() => void pasteClipboard(setKey, (m) => toast(m, "error"))}
            >
              <ClipboardIcon className="h-4 w-4" />
              {readingClipboard ? "Reading…" : "Paste"}
            </Button>
            <Button
              className="flex-1"
              loading={activating}
              disabled={!key.trim()}
              onClick={() => void activate()}
            >
              {activating ? LICENSE.activateSubmitting : LICENSE.activate}
            </Button>
          </div>
        </div>

        {license?.deviceId && (
          <p className="mt-4 break-all text-[10px] text-ink-400">{LICENSE.deviceLabel}: {license.deviceId}</p>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-brand-50 via-ink-50 to-ink-50">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-100 blur-3xl"
        aria-hidden
      />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="relative w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}