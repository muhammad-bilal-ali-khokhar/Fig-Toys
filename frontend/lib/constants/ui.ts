export const UI = {
  loading: "Loading…",
  signingIn: "Signing in…",
  signIn: "Sign in",
  signOut: "Sign out",
  error: "Something went wrong",
  retry: "Try again",
  pageNotFound: "Page not found",
  pageNotFoundHint: "The page you're looking for doesn't exist.",
  backToDashboard: "Back to dashboard",
} as const;

export const DEFAULT_PAGE_SIZE = 50;

export const TOAST = {
  maxVisible: 3,
  durationMs: 3200,
} as const;

export const MAX_MONEY_AMOUNT = 99_000_000;

export const TIMEZONES = [
  { value: "Asia/Karachi", label: "Karachi (PKT, UTC+5)" },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { value: "Asia/Kabul", label: "Kabul (UTC+4:30)" },
  { value: "Asia/Riyadh", label: "Riyadh (UTC+3)" },
  { value: "Asia/Dhaka", label: "Dhaka (UTC+6)" },
  { value: "Asia/Colombo", label: "Colombo (UTC+5:30)" },
  { value: "Asia/Kolkata", label: "Kolkata (UTC+5:30)" },
  { value: "UTC", label: "UTC" },
] as const;
