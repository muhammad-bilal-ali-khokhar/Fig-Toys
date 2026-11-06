export const APP = {
  name: "Fig Toys",
  nameFull: "Fig Toys POS",
  tagline: "Simple sales and inventory management for toy shops",
  footer: "Toy inventory · Fast checkout · Credit & analytics",
  storeSub: "Toy Shop",
  signInTitle: "Sign in to your store",
  // Build-verification marker shown only on dev builds (never in production).
  devMarker: process.env.NODE_ENV !== "production" ? "DEV-20260817" : "",
} as const;

export const UPDATE = {
  title: "Check for updates",
  current: "Current version",
  available: "Update available",
  upToDate: "You're on the latest version.",
  checking: "Checking for updates…",
  downloading: "Downloading update…",
  download: "Download update",
  downloaded: "Update ready to install.",
  installing: "Installing — watch the separate updater window…",
  install: "Install & restart",
  later: "Later",
  changelog: "What's new",
  retry: "Check again",
  notElectron: "Updates are handled by the desktop app. In a browser, just download the latest installer from the website.",
  error: "Could not check for updates",
  app: "App",
  downloadSite: "https://download.myko.pk",
  releases: "https://download.myko.pk",
  timeoutHint: "Slow connection — timed out. Tap Check again — we retry automatically and allow up to 30s on slow networks.",
  downloadTimeoutHint: "Download uses differential updates now (only changed parts, a few MB). If it keeps failing, use Direct download.",
  differentialHint: "Fast update — only changed parts download (a few MB, not the full ~100 MB).",
  installingHint: "The app will close and a small Installing window will appear — please wait, your PC is updating, do not turn it off.",
} as const;

export const DEFAULT_LOCALE = "en-PK";

export const DEFAULT_TIMEZONE = "Asia/Karachi";

export const ROOT_DOMAIN = "fig.myko.pk";

function resolveApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h.endsWith(ROOT_DOMAIN) || h === "localhost" || h === "127.0.0.1") return "/api";
    return "/api";
  }
  return "/api";
}

export const API_BASE = resolveApiBase();
