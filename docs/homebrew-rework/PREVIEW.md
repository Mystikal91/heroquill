# The preview of the homebrew rework

While the rework is not in the normal version, the branch `homebrew-rework` is shown to testers at
**https://develop.heroquill.app**. It is a second site, not a path of the normal one.

- **Own address, own data.** Browser storage (characters, packs, settings) belongs to an address, so the
  preview keeps everything apart from heroquill.app. Nothing is imported from the normal version, and a
  test cannot touch a real character. (A path like `/develop` on the same address would share it all.)
- **Every push to the branch replaces it.** `.github/workflows/deploy-develop.yml` runs the lint, the type
  check and the tests, builds with `VITE_CHANNEL=develop`, and deploys the Worker `heroquill-develop`
  (`wrangler.develop.jsonc`) with the same Cloudflare secrets as the normal deploy
  (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). The normal workflow does not run for this branch.
- **Marked as a preview.** A line at the top of the app says so (`src/ui/DevBanner.tsx`), and the installed
  app is named "Heroquill (develop)".
- **Closed to search engines.** `scripts/develop-channel.mjs` writes a `robots.txt` that disallows
  everything and adds `X-Robots-Tag: noindex` to every answer.
- **Google Drive** sign-in does not work there (the address is not one the sign-in knows).
- **To try the same build here:** `VITE_CHANNEL=develop npm run build && node scripts/develop-channel.mjs`.
- **To retire it:** delete the Worker `heroquill-develop` in Cloudflare (which frees the address), and the
  workflow and `wrangler.develop.jsonc` with the branch once it is merged.
