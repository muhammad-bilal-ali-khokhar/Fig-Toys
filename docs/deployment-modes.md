# Deployment Modes & Multi-Shop Roadmap

## Status

Proposed · Last updated: 2026-08-21

## Vision

Fig POS ships one app that runs in two modes today, and grows into a multi-terminal,
multi-shop platform later:

```
Company
 └── Shops (one or many)
      └── PCs / terminals per shop (one or many)
           └── Users (login scoped to their shop; owner sees all)
```

- **Now**: every install runs **fully local** (offline) or **fully online** (thin client).
  No mixing, no partial sync.
- **Later**: sync between local and online data, then the full hierarchy above —
  multiple PCs per shop, multiple shops per company, all scoped by user login.

## Mode 1 — Fully local (offline)

Exactly how the app works today:

- Electron shell spawns bundled Express backend + Next.js frontend on fixed localhost ports.
- SQLite database lives on this PC (`<userData>/data/fig.db`), with backups.
- Works with zero internet; failed writes queue locally until connectivity returns.
- Data never leaves the computer except explicit crash reports / updates.

## Mode 2 — Fully online (thin client)

- The desktop app still renders its local UI, but **all API calls go to the hosted cloud backend**.
- Implementation leverages the existing same-origin proxy: the shell spawns the local Next
  server with `BACKEND_URL=<cloud URL>` instead of spawning a local backend (`next.config.mjs`
  rewrites `/api/*`). No CORS changes, no token rework, cookies flow through the proxy unchanged.
- No local database is created or used in this mode.
- Requires internet at all times; UI shows a connectivity pill when offline.

### Choosing a mode

- **First-run setup**: after install, a welcome screen asks
  "Run on this computer" vs "Use online workspace" (+ URL input for the latter).
- **Changeable later** in Settings → Desktop app ("Where your data lives"),
  visible/editable to **Admin role only**. Switching restarts the app.
- Choice persists in `fig-runtime.json`: `{ setupDone, mode, serverUrl }`.

## Implementation phases

### Phase 1 — Shell (`desktop/main.js`)

1. Extend runtime config with `setupDone`, `mode: "local" | "online"`, `serverUrl`; sanitize on read.
2. First-run: if `!setupDone`, spawn only the local frontend (no backend/DB), load `/welcome`.
3. Local mode: unchanged startup flow.
4. Online mode: skip backend spawn + DB init; spawn frontend with `BACKEND_URL=<serverUrl>`;
   health-probe via proxy to cloud `/api/health`.
5. Update `runtime:set` IPC: validate `serverUrl` (https), persist, relaunch.

### Phase 2 — Frontend

6. New `/welcome` route: two choice cards, URL validation, calls `window.fig.runtime.set`.
7. Settings → Desktop app: "Where your data lives" card, admin-gated change dialog;
   restore `window.fig.runtime` typing in `electron.d.ts`; labels in `lib/constants.ts`.

### Phase 3 — Online-mode hardening

8. Connectivity indicator (top bar) in online mode.
9. Disable silent localStorage write-queue in online mode (show clear errors instead) so data
   never invisibly diverges before real sync exists.
10. Looser fetch timeouts/retries for WAN latency.

### Phase 4 — Docs & release notes

11. Sync `docs/architecture.md` with reality; add RELEASE_NOTES entry.

---

# Hosting & Tenancy Plan

## Decision: Cloudflare?

**Cloudflare as compute: no. Cloudflare in front: yes.**

The backend is Express + Prisma + SQLite (Node.js). Cloudflare Workers runs V8 isolates,
not Node — moving there means rewriting the entire backend to Hono/Workers plus migrating
Prisma to D1-compatible drivers. That is a full rewrite for zero customer-facing gain right now.

What Cloudflare **is** worth (free tier):

- DNS for `*.dostpos.com` (or final domain).
- CDN/proxy in front of each company endpoint: TLS termination, DDoS shielding, caching of
  static frontend assets.
- Nothing else changes behind it — origin stays a normal Node host.

## Hosting options for the origin (Node)

| Option | Cost | Effort | Notes |
|---|---|---|---|
| **Render** (current, `render.yaml`) | $$ per instance | Zero — already configured | Paid tier required for always-on; costs multiply with per-company instances |
| **Hetzner / DO VPS + Docker Compose + Caddy** | ~$10–20/mo total | One-time setup | Cheapest at scale; many company containers on one box; Mumbai region available |
| **Fly.io** | $ | Small | Per-app volumes, good latency regions |

**Plan**: stay on Render while piloting (zero work). Structure deployment as Docker Compose +
Caddy from the start of Phase 1 so lifting everything to a Hetzner VPS is a copy-paste when
per-company instances make Render pricing hurt. Latency target for Pakistan: Mumbai/Bahrain regions.

## Decision: individual endpoint per company?

**Yes — one isolated stack per company**, not shared multi-tenancy:

```
https://ali-mobile.dostpos.com   → container A → /data/ali-mobile.db
https://starphones.dostpos.com   → container B → /data/starphones.db
```

Why this fits our exact stack:

1. **SQLite is single-file** — one container per company means one `.db` file per company.
   Backup, restore, export, or deleting a customer becomes file operations.
2. **Trust**: Pakistani shop owners hear "your data is completely separate from other shops"
   and sign up. Shared-DB tenancy is a harder sell.
3. **Blast radius**: one company's spike/outage/corruption cannot touch another.
4. **Licensing/billing** is enforced at provisioning: no valid license → no container renewal.
5. **Zero app changes**: the desktop thin client already accepts any `serverUrl`, so a
   per-company subdomain just works. Multiple PCs of the same company all point at the
   same company endpoint (that is Mode 2 working as designed).

Costs/limits of this choice:

- Ops overhead grows linearly with companies → mitigated by a **provisioning script**
  (create volume + container + DNS record + seeded company/shop/admin row, return URL),
  and by the VPS path where marginal cost per extra company ≈ Rs 0.
- Revisit **shared multi-tenancy only if** we pass roughly 50+ active companies or ops
  burden becomes the bottleneck. Insurance policy until then: when the sync phase adds
  schema changes anyway, include `companyId` columns so switching models later is a
  migration, not a redesign.

## Rollout order

1. Phases 1–4 above (modes work end-to-end, pilot shops use local mode).
2. Stand up first per-company online endpoint on Render; pilot one shop fully online.
3. Add provisioning script + Docker/Caddy setup; migrate to Hetzner VPS when count demands.
4. Sync phase (local ⇄ company-endpoint replication).
5. Multi-shop hierarchy + user-scoped access on top.
