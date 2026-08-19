"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { useSetupStatus } from "@/lib/use-setup";
import { useLicenseStatus } from "@/lib/use-license";
import type { CompanyProfile } from "@/lib/api-types";
import { useLogin } from "@/components/login/use-login";
import { LoginShell } from "@/components/login/login-shell";
import { LoginForm } from "@/components/login/login-form";
import { APP } from "@/lib/constants";

export default function LoginPage() {
  const { user, status } = useAuth();
  const { data: profile } = useApi<CompanyProfile>("/settings/company");
  const { needsSetup, loading: setupLoading } = useSetupStatus();
  const { license, loading: licenseLoading } = useLicenseStatus();
  const router = useRouter();

  const {
    username,
    setUsername,
    pin,
    submitting,
    remembered,
    showMenu,
    setShowMenu,
    pinRef,
    usernameRef,
    selectUser,
    clearRemembered,
    handleOtpChange,
    submit,
  } = useLogin();

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

  return (
    <LoginShell profile={profile}>
      <LoginForm
        username={username}
        setUsername={setUsername}
        pin={pin}
        submitting={submitting}
        remembered={remembered}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        pinRef={pinRef}
        usernameRef={usernameRef}
        onSelectUser={selectUser}
        onClearRemembered={clearRemembered}
        onOtpChange={handleOtpChange}
        onSubmit={submit}
      />
    </LoginShell>
  );
}