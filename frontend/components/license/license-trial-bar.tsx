"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LICENSE } from "@/lib/constants";
import {
  formatLicenseMoment,
  formatRemaining,
  remainingParts,
} from "@/lib/license-time";
import { useLicenseStatus } from "@/lib/use-license";

export function LicenseTrialBar() {
  const { license } = useLicenseStatus();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!license || license.status !== "TRIAL") return null;

  const endsAt = license.trialEndsAt ?? license.expiresAt;
  if (remainingParts(endsAt, now).totalMs <= 0) return null;

  return (
    <Link
      href="/settings?tab=license"
      className="flex shrink-0 items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-xs font-semibold text-warning ring-1 ring-inset ring-warning/20 transition hover:bg-warning/20 print:hidden"
    >
      <span>{LICENSE.trial}</span>
      <span className="text-ink-700">{formatRemaining(endsAt, now)}</span>
      <span className="hidden text-ink-500 sm:inline">
        {LICENSE.trialEndsLabel} {formatLicenseMoment(endsAt)}
      </span>
    </Link>
  );
}
