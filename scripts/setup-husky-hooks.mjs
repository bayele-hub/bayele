// Writes the Bayele husky hook files.
//
// Why this exists: some sync/bridge tooling refuses to write under .husky/ directly,
// so the hooks are generated here instead. Runs as part of `prepare` (after `husky`
// sets up .husky/_), and can be run manually any time: `node scripts/setup-husky-hooks.mjs`.
//
// Files are written with LF line endings and no BOM so the /bin/sh shebang works on
// every platform (a CRLF or BOM before `#!` breaks hook execution on Unix shells).

import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';

const PRE_COMMIT = `#!/usr/bin/env sh
#
# Bayele pre-commit gate — secret scanning with gitleaks.
# Blocks a commit if a secret (API key, token, Supabase secret key, private key…)
# is found in the staged changes, so credentials never enter git history.
#
# Requires the gitleaks binary on PATH:
#   Windows:  winget install Gitleaks.Gitleaks      (or: scoop install gitleaks)
#   macOS:    brew install gitleaks
#   Linux:    see https://github.com/gitleaks/gitleaks#installing
#
# Emergency bypass (use sparingly): git commit --no-verify

if ! command -v gitleaks >/dev/null 2>&1; then
  echo ""
  echo "✖ gitleaks is not installed — cannot scan staged changes for secrets."
  echo "  Install it:  winget install Gitleaks.Gitleaks   (Windows)"
  echo "               brew install gitleaks              (macOS)"
  echo "  Then commit again. Emergency bypass: git commit --no-verify"
  echo ""
  exit 1
fi

echo "▶ gitleaks: scanning staged changes for secrets…"

# \`protect --staged\` scans only what's staged. On gitleaks >= 8.19 the equivalent
# is \`gitleaks git --staged\`; protect still works (with a deprecation notice).
if gitleaks protect --staged --redact --config .gitleaks.toml; then
  echo "✓ gitleaks: no secrets found in staged changes."
  exit 0
else
  echo ""
  echo "✖ gitleaks found a potential secret in your staged changes — commit blocked."
  echo "  Remove the secret (move it to an env var), then re-stage and commit."
  echo "  If this is a confirmed false positive, add an allowlist entry to .gitleaks.toml."
  echo "  Emergency bypass (not recommended): git commit --no-verify"
  echo ""
  exit 1
fi
`;

const PRE_PUSH = `#!/usr/bin/env sh
#
# Bayele pre-push gate.
# Runs the SAME build Vercel runs (\`pnpm run build\` -> turbo -> next build + tsc),
# so type errors and build failures are caught locally and never reach production.
#
# Emergency bypass (use sparingly): git push --no-verify

echo ""
echo "▶ Bayele pre-push: running the production build locally to mirror Vercel…"
echo ""

if ! command -v pnpm >/dev/null 2>&1; then
  echo "✖ pnpm was not found on PATH inside the hook shell."
  echo "  Enable it with:  corepack enable && corepack prepare pnpm@9.12.0 --activate"
  echo "  Or bypass once:  git push --no-verify"
  exit 1
fi

if pnpm run build; then
  echo ""
  echo "✓ Build passed — pushing to origin."
  echo ""
  exit 0
else
  echo ""
  echo "✖ Build FAILED — push blocked so the broken commit never deploys."
  echo "  Fix the errors above and push again."
  echo "  Emergency bypass (not recommended): git push --no-verify"
  echo ""
  exit 1
fi
`;

mkdirSync('.husky', { recursive: true });

for (const [name, body] of [
  ['.husky/pre-commit', PRE_COMMIT],
  ['.husky/pre-push', PRE_PUSH],
]) {
  writeFileSync(name, body, { encoding: 'utf8' }); // utf8, LF, no BOM
  try {
    chmodSync(name, 0o755); // no-op on Windows, needed on Unix
  } catch {
    /* ignore */
  }
  console.log(`✓ wrote ${name}`);
}

console.log('husky hooks ready.');
