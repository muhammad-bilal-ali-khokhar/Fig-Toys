# AGENTS.md

Guidelines for AI agents and contributors working in this repo.

## Project

Fig Mobile POS — point of sale for Pakistani mobile phone shops (new + used phones, IMEI tracking, credit, analytics). Pakistani market → **PKR / Rs**, never INR/₹.

- `backend/` — Express + TypeScript + Prisma REST API. **One folder per endpoint** under `backend/endpoints/` (e.g. `/api/user` → `endpoints/user/`, `/api/user/invoice` → `endpoints/user/invoice/`). Each endpoint folder owns `routes.ts`, `handlers.ts`, `service.ts`, `schemas.ts`. Shared infra only in `backend/core/`.
- `frontend/` — Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui. Talks to the backend API only (no DB access).
- `docs/` — source of truth: PRD, data model, architecture, roadmap. Update docs when the plan changes.

## Commands

- Frontend dev server (live updates): `cd frontend && npm run dev`
- Backend: `cd backend && npm run dev` (once scaffolded)
- Typecheck (safe while dev server runs): `cd frontend && npx tsc --noEmit`

## CRITICAL RULES

- **NEVER run `npm run build` while the dev server is running.** The server runs with live updates — do not disturb it. Use `npx tsc --noEmit` for verification instead.
- **Do not restart or kill the running dev server** unless the user asks. Verify changes via typecheck and by letting the user refresh the browser.
- **No hardcoded values.** Use `frontend/lib/constants.ts` for all brand colors, app text, nav items, KPI labels, storage keys, etc. Colors are referenced via Tailwind theme tokens (`brand-*`, `ink-*`) defined in `frontend/app/globals.css`. Hex values live only in `constants.ts` / `globals.css`.
- **No code comments** unless explicitly asked.
- **No duplication** — unified `Contact` (customer+vendor+walk-in), one `Unit` per physical phone (IMEI), one `Transaction` model for purchase/sale/returns.
- **Pakistani context** — currency is PKR (`Rs`), receipts/company profile use PKR.
- **No role color dots** — the owner hates status/legend dots next to names/roles (e.g. next to "Admin" / "Manager" in the users list). Do not add colored dots to labels, names, or list rows.
- **Auth** — preregistered users only (no signup/OAuth). Simple login page + JWT.
- **Release descriptions** — every feature/change MUST add a clear, user-facing description (what was actually done, not just the commit message) to the top (`## Unreleased`) section of `docs/RELEASE_NOTES.md`. Do the same for any notable fix, refactor, or tooling change. The GitHub Release body is built from this file, so keep entries human-readable and specific.
- Don't commit unless explicitly asked.

## Conventions

- Money as decimal (never floats) — backend.
- NEW vs USED phones are clearly separated in UX (buy flows, inventory views, reports) but one unified `Unit.condition` in data.
- Roles: Admin / Manager / Cashier. Cost/profit hidden from Cashier.
- Follow existing file style and the patterns in `docs/architecture.md`.
