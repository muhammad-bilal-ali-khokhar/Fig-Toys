import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "@/components/icons";
import { APP, ONBOARDING } from "@/lib/constants";

export function DoneStep({ username, companyName }: { username: string; companyName: string }) {
  const router = useRouter();
  return (
    <div className="mt-7 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckIcon className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-lg font-bold text-ink-900">{ONBOARDING.doneTitle}</h1>
      <p className="mt-1 text-xs text-ink-500">{ONBOARDING.doneSubtitle}</p>
      <p className="mt-4 text-xs text-ink-400">
        {username}
        <span className="mx-1 text-ink-300">·</span>
        {companyName.trim() || APP.nameFull}
      </p>
      <Button className="mt-7 w-full" onClick={() => router.replace("/login")}>
        {ONBOARDING.goToLogin}
      </Button>
    </div>
  );
}