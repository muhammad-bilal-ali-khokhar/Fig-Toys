import type { ReactNode } from "react";

export function StepCard({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-7">
      <h1 className="text-center text-lg font-bold text-ink-900">{title}</h1>
      <p className="mt-1 text-center text-xs text-ink-500">{subtitle}</p>
      <div className="mt-6">{children}</div>
      {footer}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500">
        {label}
        {hint && <span className="font-normal normal-case tracking-normal text-ink-400">: {hint}</span>}
      </label>
      {children}
    </div>
  );
}