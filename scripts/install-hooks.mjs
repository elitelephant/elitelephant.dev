// Points git at the versioned hooks in .githooks (pre-push runs `npm run verify`). Skipped outside a git checkout and in CI.
import { execFileSync } from 'node:child_process';

if (!process.env.CI && !process.env.VERCEL) {
  try {
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  } catch {
    // Not a git checkout: nothing to install.
  }
}
