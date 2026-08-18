export function isAdminRequest(request: Request): boolean {
  const expected = process.env.LICENSE_ADMIN_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get("Authorization");
  if (!auth) return false;
  return auth === `Bearer ${expected}`;
}

export function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}