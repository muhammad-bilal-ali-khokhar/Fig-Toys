# Owner console deployment

The owner console is a Next.js app with its own backend routes. It talks to Convex and does not need the POS Express backend.

## Cloudflare Workers

- Worker name: `fig-license-admin`
- Production URL: `https://admin.fig.myko.pk`
- Custom domain: `admin.fig.myko.pk`
- Build and deploy: `cd web && npm run deploy`
- Preview: `cd web && npm run preview`
- Config: `web/wrangler.jsonc`, `web/open-next.config.ts`

The GitHub workflow `.github/workflows/deploy-owner-console.yml` runs typecheck, deploys the Worker and sets the runtime secrets.

Required GitHub secrets:
- `CLOUDFLARE_API_TOKEN` with Workers Scripts Edit, R2 Edit and Account Settings Read
- `CLOUDFLARE_ACCOUNT_ID`
- `CONVEX_SITE_URL` (production Convex site, `https://silent-possum-224.convex.site`) as a repository variable
- `LICENSE_ADMIN_TOKEN` (the same value configured on the Convex deployment)
- `OWNER_ADMIN_EMAIL`
- `OWNER_ADMIN_PASSWORD`
- `OWNER_ADMIN_SESSION_SECRET` (a long random string)

## Convex

- Deploy: `cd convex && npx convex deploy`
- Workflow: `.github/workflows/deploy-convex.yml`
- Secret: `CONVEX_DEPLOY_KEY` for the production deployment
- Set the production Convex env values in the Convex dashboard before deploying: `LICENSE_ADMIN_TOKEN`, `LICENSE_PRIVATE_KEY`, `PORTAL_BASE_URL`.

## Release management

The console reads the published release list from `https://download.myko.pk/versions.json`. One-click releases are optional: create a fine-grained GitHub token for `myko-pakistan-bwp/Fig-POS` with **Actions: Read and write**, then set it as `GITHUB_RELEASE_TOKEN` on the Worker (or as the GitHub secret used by the deploy workflow). The Releases page will then be able to start the `Release` workflow on `main`.

## First login and users

The first successful login creates the first Owner account from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. After that, logins use the Users table in Convex. Manage accounts at `/users`:

- Owner: full control, including other Owners.
- Admin: can manage shops, payments and Admin or Support users.
- Support: read-only access.

Passwords are hashed with PBKDF2 on the server. Existing sessions need to sign in again after this deployment because the session payload now includes the role.

## Local development

`web/.env.local` is used locally and is gitignored. Set:

```
CONVEX_SITE_URL=...
LICENSE_ADMIN_TOKEN=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
ADMIN_SESSION_SECRET=...
```

## Desktop release

The desktop release workflow now requires a repository variable:

- `CONVEX_SITE_URL` = the production Convex site URL, for example `https://your-prod.convex.site`.

The redeem URL is derived automatically as `CONVEX_SITE_URL + "/redeem"`. Before packaging, `.github/workflows/release.yml` writes `desktop/cloud.json`. The packaged app reads it before the built-in fallback. The workflow fails if the variable is missing or points at localhost.

Add the variable in GitHub under Settings, Secrets and variables, Actions, Variables.
