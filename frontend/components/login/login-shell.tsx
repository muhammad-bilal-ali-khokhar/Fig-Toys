import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { APP, AUTH } from "@/lib/constants";
import type { CompanyProfile } from "@/lib/api-types";

export function LoginShell({
  profile,
  children,
}: {
  profile?: CompanyProfile | null;
  children: ReactNode;
}) {
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
            {children}
          </div>
        </div>
      </div>

      <footer className="relative z-10 flex flex-col items-center gap-2 px-4 pb-8">
        <div className="flex max-w-full items-center gap-2">
          <Logo size={20} src={profile?.logoUrl} />
          <p
            className="max-w-[16rem] truncate text-sm font-bold tracking-tight text-ink-900"
            title={profile?.name ?? APP.nameFull}
          >
            {profile?.name ?? APP.nameFull}
          </p>
        </div>
        <p
          className="max-w-sm truncate text-xs text-ink-400"
          title={profile?.tagline ?? APP.tagline}
        >
          {profile?.tagline ?? APP.tagline}
        </p>
        <p className="text-[10px] font-semibold text-brand-600">{APP.devMarker}</p>
      </footer>
    </main>
  );
}