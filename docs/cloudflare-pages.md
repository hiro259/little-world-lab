# Cloudflare Pages deployment — Little World Lab

This project is a **static Vite + Three.js website**. GitHub remains the source of truth. Cloudflare Pages builds and publishes the `main` branch automatically; no API tokens, Workers, external servers, or backend are required.

## Initial setup (Cloudflare account owner)

1. Open [Cloudflare Dashboard → Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
2. Choose **Create application → Pages → Connect to Git**. If Cloudflare prompts for GitHub authorization, grant access to the **`hiro259/little-world-lab`** repository. Prefer **Only select repositories** when offered rather than authorizing everything.
3. Pick **`hiro259/little-world-lab`** and choose **Begin setup**.
4. Enter the settings below, then **Save and Deploy**.

| Field | Value |
|---|---|
| Pages project name | `little-world-lab` (if available; otherwise choose another) |
| Git provider | GitHub |
| Repository | `hiro259/little-world-lab` |
| Production branch | `main` |
| Framework preset | Vite, or None with the manual settings below |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Repository root (default) |
| Node.js version | `22.16.0` via `.node-version` |
| Environment variables | None |

5. Wait for **Success** in the deployment log. Copy the actual `https://<project>.pages.dev/` URL displayed by the Cloudflare dashboard. The URL is **not** known before Cloudflare creates the project.
6. Open the link in two browsers or devices. Verify the grass, character, and movement on desktop (mobile touch input will be added under Issue #5).

## Safe update flow during the presentation

1. ChatGPT creates a branch and makes a small, visible change.
2. Check the GitHub PR / CI, and optionally open the Cloudflare preview URL for that PR.
3. Merge the validated change into `main`.
4. In Cloudflare **Workers & Pages → project → Deployments**, wait for the production deployment to show **Success**.
5. Ask visitors to **reload the existing page**. They do not need to install an app or log in; their game sessions are independent.

**Do not announce that an update is live until the production deployment succeeds.** Vite names production assets with a content hash; Cloudflare Pages' default cache behavior is designed to serve fresh deployments without custom cache rules. If someone still sees an old version, retry reload / hard reload before changing cache settings.

### Preview branch builds and usage

Pages may build PR/preview branches as well as `main`. To avoid unnecessary builds, use **Settings → Builds → Branch control** to configure whether all non-production branches, no branches, or selected branches are previewed. Keeping preview branches enabled is useful for checking each change before merge. The free plan's build quota applies to builds, not visitor page refreshes.

Preview URLs are not a substitute for authentication; do not put secrets in a public repository or a client-side application.

## If a deployment fails

- Cloudflare **Deployments → select failed deployment → View build log**: check dependency installation, Node version, build command, and output directory.
- Reproduce locally using `npm install && npm run build && npm run preview`.
- Confirm the deploy is reading `main`, not a feature branch.
- A failed production build should not replace the previously published successful version.
- Never put Cloudflare API tokens in `src/`, `public/`, or GitHub commits.

### Roll back to a known-good version

1. Cloudflare **Deployments → All deployments**.
2. Find a previous successful **production** deployment.
3. From that deployment's **⋯** menu select **Rollback to this deployment**, then confirm.
4. Confirm the public URL once more; afterwards revert/fix the bad commit in GitHub as well, otherwise the next `main` deployment might reintroduce the problem.

Cloudflare's rollback applies to production deployments, not preview deployments.

## End of event

You may keep the project live for participants, or delete it from **Workers & Pages → project → Settings → Delete project**. This setup uses only the assigned `pages.dev` address and does **not** touch `hoshitsunagi.app` or its DNS settings.

A `public/_headers` rule asks search engines not to index this temporary site (`X-Robots-Tag: noindex`). **It does not restrict access.** Anyone with the URL can still view the game.

## Official documentation

- [Git integration and initial deployment](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [GitHub integration / preview deployments](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)
- [Branch build controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
- [Rollback to an earlier deployment](https://developers.cloudflare.com/pages/configuration/rollbacks/)
- [Static Pages caching](https://developers.cloudflare.com/pages/configuration/serving-pages/)
