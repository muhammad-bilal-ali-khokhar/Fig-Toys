# Release Notes

Human-written, user-facing descriptions of what actually changed in each
release. The top section is the one being worked on; when a release is cut the
workflow uses it (the section above the next `## v` heading) as the GitHub
Release body.

## Unreleased

- **Human-written release descriptions** — every release now ships with a
  clear, user-facing description instead of a raw dump of commit messages. The
  download page at fig.myko.pk shows these notes under the latest version and
  in the version history, and older releases (v0.1.47 and up) were backfilled
  with their descriptions too.

## v0.1.51

- **Versioned download folders** — each release is now stored in its own
  `v0.1.XX/` folder in the R2 bucket, and the site keeps the last 5 versions
  with a working download link for each.
- **Fixed download button** — it was stuck on the placeholder link and missing
  the version metadata; the site now loads release data reliably so "Download
  for Windows" grabs the correct installer.
- **Reliable release data on the site** — the download page reads version info
  from the bucket without being blocked (CORS + script loading fixes), so the
  version number, file size, release date, and version history all show
  correctly.

## v0.1.50

- **Public download site** — a new landing page at fig.myko.pk that fetches
  the latest installer from the CDN, with the new Fig icon, dark mode, and a
  flat modern design.
- **Hosted installers on Cloudflare R2** — releases now auto-upload the
  Windows installer and auto-update files to the public R2 bucket, so the app
  and installer are downloadable from the web.

## v0.1.49

- **Online license activation** — customers get a 10-digit activation code
  that is redeemed online for a signed license key; activation, minting, and
  verification are handled by a cloud backend with admin-only endpoints.
- **Global search** — find phones, customers, and records from anywhere in the
  app.
- **Print overhaul + reservations/settings updates** — cleaner receipts and
  updated reservations and settings flows.

## v0.1.48

- **License activation with device locking** — the app now locks to the
  machine it is activated on and shows a dedicated activation screen on first
  run.

## v0.1.47

- **Installer update prompt + rebrand to Fig POS** — smoother in-app update
  notices, and the product is now called Fig POS with new splash images.
- **Category hierarchy + POS discount refactor** — nested categories and a
  cleaner discount flow at checkout.