import { env } from "../../core/config/env";
import { ApiError } from "../../core/middleware/error";
import { prisma } from "../../core/lib/prisma";
import { COMPANY_ID } from "../../core/lib/company";
import type { CrashReportInput } from "./schemas";

const DEFAULT_REPO = "arsalanwahab/Fig-POS";

function repo(): string {
  const custom = (env.FIG_GH_REPO || "").trim();
  if (custom) return custom.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
  return DEFAULT_REPO;
}

function hasToken(): boolean {
  return Boolean((env.FIG_GH_TOKEN || "").trim());
}

async function context() {
  const [company, users] = await Promise.all([
    prisma.companyProfile.findUnique({
      where: { id: COMPANY_ID },
      select: { name: true, tagline: true, address: true, phone: true, email: true, website: true, currency: true },
    }),
    prisma.user.findMany({
      select: { username: true, name: true, email: true, role: true, active: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const companyLines = company
    ? [
        `**Company:** ${company.name || "?"}`,
        company.tagline ? `**Tagline:** ${company.tagline}` : "",
        company.address ? `**Address:** ${company.address}` : "",
        company.phone ? `**Phone:** ${company.phone}` : "",
        company.email ? `**Email:** ${company.email}` : "",
        company.website ? `**Website:** ${company.website}` : "",
        company.currency ? `**Currency:** ${company.currency}` : "",
      ]
    : ["**Company:** not set"];

  const userLines = users.map(
    (u) =>
      `- ${u.name} (@${u.username}) · ${u.role} · ${u.email} · ${u.active ? "active" : "inactive"}`,
  );

  return [...companyLines, "", "**Users on this machine:**", ...(userLines.length ? userLines : ["- none"])];
}

export async function submitCrashReport(input: CrashReportInput) {
  const token = (env.FIG_GH_TOKEN || "").trim();
  if (!token) {
    throw new ApiError(
      501,
      "feedback.not_configured",
      "Crash reporting is not configured on this server.",
    );
  }

  const ctx = await context();

  const detail = [
    `**App:** ${input.app}`,
    input.version ? `**Version:** ${input.version}` : "",
    input.platform ? `**Platform:** ${input.platform}` : "",
    "",
    "## Account / company",
    ...ctx,
    "",
    "---",
    input.body,
    "",
    input.logTail ? `--- log tail ---\n${input.logTail}` : "",
  ]
    .filter((s) => s !== "")
    .join("\n");

  const url = `https://api.github.com/repos/${repo()}/issues`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Fig-Mobile-POS",
    },
    body: JSON.stringify({ title: input.title, body: detail }),
  });

  if (!res.ok) {
    throw new ApiError(502, "feedback.forward_failed", `GitHub API ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { html_url?: string };
  return { url: json.html_url || "" };
}

export { hasToken, repo };
