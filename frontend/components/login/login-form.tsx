import { OtpInput } from "@/components/auth/otp-input";
import { LockIcon, TrashIcon, UserIcon, UsersIcon } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { AUTH, PIN_LENGTH } from "@/lib/constants";
import type { RefObject } from "react";

type Props = {
  username: string;
  setUsername: (value: string) => void;
  pin: string;
  submitting: boolean;
  remembered: string[];
  showMenu: boolean;
  setShowMenu: (value: boolean) => void;
  pinRef: RefObject<HTMLInputElement | null>;
  usernameRef: RefObject<HTMLDivElement | null>;
  onSelectUser: (name: string) => void;
  onClearRemembered: () => void;
  onOtpChange: (next: string) => void;
  onSubmit: (pin: string) => void;
};

export function LoginForm({
  username,
  setUsername,
  pin,
  submitting,
  remembered,
  showMenu,
  setShowMenu,
  pinRef,
  usernameRef,
  onSelectUser,
  onClearRemembered,
  onOtpChange,
  onSubmit,
}: Props) {
  return (
    <form
      className="mt-6 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(pin);
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
                onClick={onClearRemembered}
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
                    onClick={() => onSelectUser(name)}
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
          onChange={onOtpChange}
          inputRef={pinRef}
        />
      </div>
    </form>
  );
}