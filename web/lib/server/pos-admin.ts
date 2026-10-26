export function posApiBase(): string {
  const configured = process.env.POS_ADMIN_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:47620/api";
  return "";
}

export function posAdminHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const token = process.env.LICENSE_LOCAL_ADMIN_TOKEN?.trim();
  if (token) headers.set("x-license-admin", token);
  return headers;
}
