"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Lock, ShieldCheck, Timer } from "lucide-react";
import { APP, DEMO_ADMIN, ROUTES, TEXT } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { Button, Field, LogoMark } from "@/components/ui";

export default function LoginPage() {
  const { authReady, adminSignedIn, signIn } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_ADMIN.email);
  const [password, setPassword] = useState(DEMO_ADMIN.password);
  const [error, setError] = useState("");
  const [next, setNext] = useState(ROUTES.overview);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("next");
    if (target && target.startsWith("/")) setNext(target);
  }, []);

  useEffect(() => {
    if (authReady && adminSignedIn) router.replace(next);
  }, [authReady, adminSignedIn, next, router]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = signIn(email, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError("");
    router.replace(next);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <div>
            <p className="text-base font-semibold tracking-tight text-white">{APP.name}</p>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-300">
              {TEXT.common.demoData}
            </p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            {TEXT.login.headline}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-brand-100/80">
            {APP.tagline} {TEXT.login.body}
          </p>

          <div className="mt-10 grid gap-4">
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <Timer className="mt-0.5 h-5 w-5 text-gold-300" />
              <div>
                <p className="text-sm font-semibold text-white">
                  {TEXT.login.featureTrialTitle}
                </p>
                <p className="mt-0.5 text-sm text-brand-200/80">
                  {TEXT.login.featureTrialBody}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <BadgeCheck className="mt-0.5 h-5 w-5 text-teal-300" />
              <div>
                <p className="text-sm font-semibold text-white">
                  {TEXT.login.featurePaymentTitle}
                </p>
                <p className="mt-0.5 text-sm text-brand-200/80">
                  {TEXT.login.featurePaymentBody}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-brand-200" />
              <div>
                <p className="text-sm font-semibold text-white">
                  {TEXT.login.featureAccessTitle}
                </p>
                <p className="mt-0.5 text-sm text-brand-200/80">
                  {TEXT.login.featureAccessBody}
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-brand-300">
          {APP.fullName} · {TEXT.login.prototype}
        </p>
      </section>

      <section className="flex items-center justify-center bg-ink-50 px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="h-10 w-10" />
            <div>
              <p className="text-sm font-semibold text-ink-900">{APP.name}</p>
              <p className="text-xs text-ink-500">{APP.adminLabel}</p>
            </div>
          </div>

          <div className="card p-7">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                {APP.adminLabel}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
                {TEXT.login.title}
              </h2>
              <p className="mt-1 text-sm text-ink-500">{TEXT.login.subtitle}</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <Field label={TEXT.login.email} htmlFor="email">
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </Field>
              <Field label={TEXT.login.password} htmlFor="password">
                <input
                  id="password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Field>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full">
                <Lock className="h-4 w-4" />
                {TEXT.login.submit}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-6 rounded-xl border border-dashed border-ink-300 bg-ink-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {TEXT.login.demoTitle}
              </p>
              <p className="mt-1 text-xs text-ink-500">{TEXT.login.demoHint}</p>
              <div className="mt-3 grid gap-2 text-xs">
                <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                  <span className="text-ink-500">{TEXT.login.email}</span>
                  <span className="font-mono font-medium text-ink-900">{DEMO_ADMIN.email}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                  <span className="text-ink-500">{TEXT.login.password}</span>
                  <span className="font-mono font-medium text-ink-900">
                    {DEMO_ADMIN.password}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white/70 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-ink-800">{TEXT.login.toClient}</p>
              <p className="text-xs text-ink-500">{TEXT.login.toClientHint}</p>
            </div>
            <Link href={ROUTES.portal} className="link text-sm">
              {TEXT.register.openPortal}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
