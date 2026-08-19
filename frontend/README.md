# Fig POS — Frontend

Next.js (App Router) + TypeScript + Tailwind CSS. Talks to the backend REST API only — no DB access.

## Setup

```bash
npm install
npm run dev      # http://localhost:58340 (Turbopack, live updates)
```

## Structure

```
frontend/
├── app/
│   ├── layout.tsx        # root layout (dark theme)
│   ├── page.tsx          # landing/splash: logo + app name
│   └── globals.css       # Tailwind v4
├── components/
│   └── brand/logo.tsx    # Fig logo (SVG)
└── lib/
    └── apiClient.ts      # (planned) fetch wrapper + JWT
```

See [`docs/architecture.md`](../docs/architecture.md) for the full plan.

## Status

Scaffolded: single landing page with Fig POS name + logo. Next up: login page + auth.
