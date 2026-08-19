import type { ReactNode } from "react";
import { APP, ONBOARDING, LICENSE } from "@/lib/constants";
import { Logo } from "@/components/brand/logo";
import {
  CheckIcon,
  LockIcon,
  SmartphoneIcon,
  SettingsIcon,
  WalletIcon,
  UserIcon,
} from "@/components/icons";

const STEPS: { label: string; description: string; Icon: typeof CheckIcon }[] = [
  { label: "License", description: "Activate your copy", Icon: LockIcon },
  { label: "Store details", description: "Your shop profile", Icon: SmartphoneIcon },
  { label: "Preferences", description: "Region & currency", Icon: SettingsIcon },
  { label: "Bank accounts", description: "Payment choices", Icon: WalletIcon },
  { label: "Administrator", description: "Your sign-in account", Icon: UserIcon },
  { label: "Done", description: "You're all set", Icon: CheckIcon },
];

function StepList({ step }: { step: number }) {
  return (
    <ol className="relative space-y-8">
      <span
        className="absolute left-[15px] top-9 bottom-2 w-px bg-white/10"
        aria-hidden
      />
      {STEPS.map(({ label, description, Icon }, i) => {
        const isActive = i === step;
        const isDone = i < step;
        return (
          <li key={label} className="relative flex items-start gap-3.5">
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                isDone
                  ? "border-transparent bg-gold-400 text-brand-950"
                  : isActive
                    ? "border-transparent bg-brand-400 text-white shadow-[0_0_0_4px_rgba(255,255,255,0.08)]"
                    : "border-transparent bg-white text-ink-500"
              }`}
            >
              {isDone ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-ink-500"}`} />
              )}
            </span>
            <div className="pt-0.5">
              <p
                className={`text-sm font-semibold leading-tight transition ${
                  isActive ? "text-white" : isDone ? "text-white/80" : "text-white/35"
                }`}
              >
                {label}
              </p>
              <p
                className={`mt-0.5 text-[11px] leading-tight ${
                  isActive ? "text-white/50" : "text-white/25"
                }`}
              >
                {description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function MobileProgress({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-1">
      {STEPS.map((_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 max-w-8 rounded-full transition ${
            i === step ? "bg-brand-600" : i < step ? "bg-brand-300" : "bg-ink-200"
          }`}
        />
      ))}
    </div>
  );
}

export function OnboardingShell({ step, children }: { step: number; children: ReactNode }) {
  return (
    <main className="flex min-h-screen bg-ink-50">
      <aside className="relative hidden w-[340px] shrink-0 flex-col overflow-hidden bg-brand-950 p-8 lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/40 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl"
          aria-hidden
        />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <div>
              <p className="text-sm font-bold leading-none tracking-tight text-white">
                {APP.nameFull}
              </p>
              <p className="mt-1 text-[10px] font-medium text-white/50">{APP.tagline}</p>
            </div>
          </div>

          <div className="mt-12">
            <h1 className="text-xl font-bold leading-snug text-white">{ONBOARDING.title}</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-white/50">
              {ONBOARDING.subtitle}
            </p>
          </div>

          <nav className="mt-10">
            <StepList step={step} />
          </nav>
        </div>

        <footer className="relative z-10 mt-auto pt-8">
          <p className="text-[10px] font-semibold text-white/40">{APP.devMarker}</p>
        </footer>
      </aside>

      <div className="flex flex-1 flex-col">
        <div className="lg:hidden border-b border-ink-200/70 bg-white/70 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Logo size={28} />
              <p className="text-sm font-bold tracking-tight text-ink-900">{APP.name}</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <div className="mt-3">
            <MobileProgress step={step} />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-xl">
            <div className="rounded-[2rem] border border-ink-200/70 bg-white p-6 shadow-xl shadow-ink-900/5 sm:p-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}