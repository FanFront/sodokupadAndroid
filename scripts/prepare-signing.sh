#!/usr/bin/env bash
# Materialize the one permanent signing identity for this workflow run.
# Secrets are supplied by GitHub Actions and must never be printed or committed.
set -euo pipefail
if [[ -z "${SUDOKUVANIA_KEYSTORE_B64:-}" || -z "${SUDOKUVANIA_SIGNING_PASSWORD:-}" ]]; then
  echo "::error title=Stable APK signing is not configured::Add SUDOKUVANIA_KEYSTORE_B64 and SUDOKUVANIA_SIGNING_PASSWORD under repository Settings > Secrets and variables > Actions. See README signing section." >&2
  exit 1
fi
: "${RUNNER_TEMP:?This script must run on a GitHub Actions runner}"
: "${GITHUB_ENV:?This script must run in a GitHub Actions job}"
umask 077
signing_dir="$RUNNER_TEMP/sudokuvania-signing"
mkdir -p "$signing_dir"
keystore="$signing_dir/sudokuvania-stable.p12"
printf '%s' "$SUDOKUVANIA_KEYSTORE_B64" | base64 --decode > "$keystore"
if [[ ! -s "$keystore" ]]; then
  echo "::error::The signing keystore is empty." >&2
  exit 1
fi
keytool -list -storetype PKCS12 -keystore "$keystore" \
  -storepass:env SUDOKUVANIA_SIGNING_PASSWORD -alias sudokuvania >/dev/null
printf 'SUDOKUVANIA_KEYSTORE_PATH=%s\n' "$keystore" >> "$GITHUB_ENV"
echo "Persistent signing keystore validated; key material stays outside the checkout."
