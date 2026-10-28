#!/usr/bin/env bash
# Run ONCE on a trusted local computer with Java/keytool installed.
# Do not commit or share these files. Back up the .p12 privately.
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
signing_dir="$repo_root/.signing"
keystore="$signing_dir/sudokuvania-stable.p12"
encoded="$signing_dir/sudokuvania-stable.base64.txt"
if [[ -e "$keystore" || -e "$encoded" ]]; then
  echo "A signing key already exists in .signing/. Refusing to replace it: updates require the SAME key." >&2
  exit 1
fi
command -v keytool >/dev/null || {
  echo "Java keytool is required. Install Java 17 (or newer) first." >&2
  exit 1
}
umask 077
mkdir -p "$signing_dir"
echo "Create a strong password and keep it forever. Keytool will prompt for it."
keytool -genkeypair -alias sudokuvania -keyalg RSA -keysize 3072 \
  -validity 10000 -storetype PKCS12 -keystore "$keystore" \
  -dname "CN=Sudokuvania Personal Android Test, O=Sudokuvania"
base64 < "$keystore" | tr -d '\n' > "$encoded"
chmod 600 "$keystore" "$encoded"
echo
echo "Created:"
echo "  Private key backup: $keystore"
echo "  GitHub Actions secret SUDOKUVANIA_KEYSTORE_B64: contents of $encoded"
echo "  GitHub Actions secret SUDOKUVANIA_SIGNING_PASSWORD: the password you entered"
echo
echo "Store both secrets in Settings > Secrets and variables > Actions."
echo "NEVER commit the .signing/ directory, put it in an issue, or send its contents in chat."
echo "Keep a secure private backup of the original .p12 and password for future upgrades."
