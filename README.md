# elitelephant.dev

Personal site: a dark card that turns over, on a mint page.

Next.js 16 (App Router), React 19, TypeScript. Every route is prerendered (`ensureStatic = "navigation"` in `app/layout.tsx`).

## Run

Node 24 (`.nvmrc`).

```sh
npm ci
npx playwright install chromium
npm run dev
```

## Verify

```sh
npm run verify
```

Runs lint, typecheck, unit tests (`node --test`), the production build and the Playwright suite against `next start`. CI runs the same on every push.

`npm ci` points git at `.githooks/`, so `git push` runs `verify` first. Pushes go straight to `main`, and every push to `main` deploys to production. Never push with `--no-verify`.

## Deploy

The Vercel project `elitelephant` is connected to this repo. Every push to `main` builds a production deployment, and a Deployment Check holds it until the CI `verify` job passes; only then does it take `elitelephant.dev`. `www.elitelephant.dev` redirects (308) to the apex.

## Roll back

If a bad build reaches production:

```sh
vercel rollback
```

This promotes the previous production deployment. Fix the problem on `main` afterwards.

## URL flags

`?quality=high|medium|low` forces a tier, `?lock` keeps it from stepping down, `?debug` shows the tier and frame rate, `?scene=0` leaves only the static rings (see `lib/params.ts`).
