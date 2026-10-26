## Summary

What does this PR do and why.

## Requirements before merge

Check every item before merging:

- [ ] Backend typecheck passes (`cd backend && npx tsc --noEmit`)
- [ ] Frontend typecheck passes (`cd frontend && npx tsc --noEmit`)
- [ ] Admin typecheck passes (`cd web && npx tsc --noEmit`)
- [ ] Local payment flow tested end to end
- [ ] No secret values in tracked files (check `git ls-files` for `.env`)
- [ ] Release notes updated under `docs/RELEASE_NOTES.md` `## Unreleased`
- [ ] Docs updated (`docs/architecture.md`, `docs/WEB_LICENSING_FLOW.md`)
- [ ] No `--` or `—` in release notes
- [ ] PR description lists new environment variables

## Environment variables

List new or changed environment variables:

| Variable | Where | Required | Description |
|---|---|---|---|
| `EXAMPLE_VAR` | backend | yes | Short description |

## Tests

What was tested and how:

- [ ] Manual test steps
- [ ] Commands to run

## Payment flow

### New manual account/QR flow

```mermaid
sequenceDiagram
  participant P as POS (shop)
  participant B as Local backend
  participant A as Admin PWA
  participant W as Push service
  P->>B: Create payment request (optional transaction ID)
  B->>A: Store pending payment
  B->>W: Send Web Push to admin
  A->>A: Admin sees notification
  A->>B: Approve payment (x-license-admin)
  B->>B: Extend license by period days
  P->>B: Poll request status
  B->>P: Approved -> unlock
```

### Previous Safepay checkout flow (kept for reference)

```mermaid
sequenceDiagram
  participant P as POS (shop)
  participant B as Local backend
  participant S as Safepay
  P->>B: Create Safepay checkout
  B->>S: Create tracker + auth token
  B-->>P: Hosted checkout URL
  P->>S: Pay on hosted checkout
  S-->>P: Redirect to callback
  P->>B: Poll tracker status
  B->>S: Fetch tracker
  S-->>B: TRACKER_ENDED
  B->>B: Extend license
```

## Rollback

How to roll this back if needed.

## Screenshots / recordings

Add any UI screenshots.
