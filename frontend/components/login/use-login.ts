"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { AUTH, PIN_LENGTH } from "@/lib/constants";

const MAX_REMEMBERED = 5;

export function useLogin() {
  const { login } = useAuth();
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
    if (submitting) return;
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
      requestAnimationFrame(() => pinRef.current?.focus());
    }
  }

  function handleOtpChange(next: string) {
    setPin(next);
    if (!submitting && next.length === PIN_LENGTH) {
      submit(next);
    }
  }

  return {
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
  };
}