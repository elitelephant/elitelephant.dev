// Points git at the versioned hooks in .githooks (commit-msg checks the message, pre-push runs `npm run verify`).
// Skipped outside a git checkout, in CI and on Vercel.
import { execFileSync } from 'node:child_process';

if (!process.env.CI && !process.env.VERCEL) {
  try {
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  } catch {
    // Not a git checkout, so nothing to install.
  }
}
