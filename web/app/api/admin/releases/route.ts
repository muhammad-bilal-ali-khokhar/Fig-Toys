import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/server/session";
import type { ReleaseInfo } from "@/lib/types";

const FEED =
  process.env.RELEASES_FEED_URL ?? "https://download.myko.pk/versions.json";
const REPO = process.env.GITHUB_REPO ?? "myko-pakistan-bwp/Fig-POS";
const WORKFLOW = process.env.GITHUB_RELEASE_WORKFLOW ?? "release.yml";

function cleanDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/^['"]|['"]$/g, "").trim();
  if (!clean) return null;
  const date = new Date(clean);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cleanVersions(value: unknown): ReleaseInfo[] {
  if (!value || typeof value !== "object") return [];
  const versions = (value as { versions?: unknown }).versions;
  if (!Array.isArray(versions)) return [];
  return versions
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => {
      const url = (entry.url ?? {}) as Record<string, unknown>;
      return {
        version: String(entry.version ?? ""),
        size: String(entry.size ?? ""),
        publishedAt: cleanDate(entry.publishedAt),
        description: String(entry.description ?? ""),
        url: {
          setup: String(url.setup ?? ""),
          blockmap: typeof url.blockmap === "string" ? url.blockmap : null,
        },
      };
    })
    .filter((entry) => entry.version);
}

export async function GET() {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const response = await fetch(`${FEED}?t=${Date.now()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Could not load the release feed.");
    const versions = cleanVersions(await response.json());
    return NextResponse.json({
      versions,
      canTrigger: session.role === "owner" || session.role === "admin",
      configured: Boolean(process.env.GITHUB_RELEASE_TOKEN),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load releases." },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.role !== "owner" && session.role !== "admin") {
    return NextResponse.json(
      { error: "Only Owners and Admins can start a release." },
      { status: 403 },
    );
  }
  const token = process.env.GITHUB_RELEASE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_RELEASE_TOKEN is not configured." },
      { status: 503 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    version?: unknown;
  } | null;
  const version = typeof body?.version === "string" ? body.version.trim() : "";
  if (version && !/^\d+\.\d+\.\d+$/.test(version)) {
    return NextResponse.json(
      { error: "Use a version like 0.2.37, or leave it blank." },
      { status: 400 },
    );
  }
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: { version },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (response.status !== 204) {
      const data = await response.json().catch(() => null);
      throw new Error(
        data && typeof data.message === "string"
          ? data.message
          : "GitHub rejected the release request.",
      );
    }
    return NextResponse.json({
      ok: true,
      runUrl: `https://github.com/${REPO}/actions/workflows/${WORKFLOW}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start the release." },
      { status: 502 },
    );
  }
}
