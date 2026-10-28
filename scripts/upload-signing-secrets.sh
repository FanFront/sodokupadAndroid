#!/usr/bin/env bash
# One-time setup using GitHub CLI; does not print or commit the private key.
set -euo pipefail
repo="${1:-FanFront/sodokupadAndroid}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
encoded="$root/.signing/sudokuvania-stable.base64.txt"
if [[ ! -s "$encoded" ]]; then
  echo "Missing $encoded — first run: bash scripts/create-signing-key.sh" >&2
  exit 1
fi
command -v gh >/dev/null || { echo "Install GitHub CLI (gh) or add the two secrets in GitHub Settings manually." >&2; exit 1; }
gh auth status >/dev/null
gh secret set SUDOKUVANIA_KEYSTORE_B64 --repo "$repo" < "$encoded"
echo "Stored SUDOKUVANIA_KEYSTORE_B64 for $repo."
read -r -s -p "Enter the keystore password you chose during key creation: " password
printf '\n'
if [[ -z "$password" ]]; then
  echo "Password cannot be empty. No password secret was changed." >&2
  exit 1
fi
printf '%s' "$password" | gh secret set SUDOKUVANIA_SIGNING_PASSWORD --repo "$repo"
unset password
echo "Stored SUDOKUVANIA_SIGNING_PASSWORD. Future GitHub Actions APK builds now use the same key."
