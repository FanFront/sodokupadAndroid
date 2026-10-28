#!/usr/bin/env bash
# Verify package, strictly increasing version code and certificate before upload.
set -euo pipefail
apk="${1:-app/build/outputs/apk/debug/app-debug.apk}"
: "${GITHUB_RUN_NUMBER:?Missing GitHub workflow build number}"
sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$sdk" ]]; then
  echo "::error::Android SDK path is unavailable" >&2
  exit 1
fi
apksigner="$sdk/build-tools/35.0.0/apksigner"
aapt="$sdk/build-tools/35.0.0/aapt"
[[ -s "$apk" ]] || { echo "::error::APK not found: $apk" >&2; exit 1; }
[[ -x "$apksigner" && -x "$aapt" ]] || { echo "::error::Android signing tools are missing" >&2; exit 1; }
"$apksigner" verify --verbose --print-certs "$apk" > "$RUNNER_TEMP/sudokuvania-apk-signature.txt"
badging="$("$aapt" dump badging "$apk")"
grep -Fq "name='com.fanfront.sodokupadandroid'" <<< "$badging" || {
  echo "::error::Signed APK application ID changed" >&2; exit 1;
}
grep -Fq "versionCode='${GITHUB_RUN_NUMBER}'" <<< "$badging" || {
  echo "::error::APK versionCode is not GitHub's increasing run number" >&2; exit 1;
}
cert_digest="$(sed -nE 's/^Signer #1 certificate SHA-256 digest: ([[:xdigit:]]+).*$/\1/p' "$RUNNER_TEMP/sudokuvania-apk-signature.txt" | head -n 1)"
if [[ ! "$cert_digest" =~ ^[[:xdigit:]]{64}$ ]]; then
  echo "::error::Cannot read the APK signing certificate SHA-256 fingerprint" >&2
  exit 1
fi
if [[ -n "${SUDOKUVANIA_SIGNING_CERT_SHA256:-}" ]]; then
  expected="$(tr -d ':[:space:]' <<< "$SUDOKUVANIA_SIGNING_CERT_SHA256" | tr '[:upper:]' '[:lower:]')"
  actual="$(tr '[:upper:]' '[:lower:]' <<< "$cert_digest")"
  if [[ "$actual" != "$expected" ]]; then
    echo "::error::Signing certificate has changed; refusing an incompatible upgrade!" >&2
    exit 1
  fi
fi
outdir="$(dirname "$apk")"
{
  printf 'applicationId=com.fanfront.sodokupadandroid\n'
  printf 'versionCode=%s\n' "$GITHUB_RUN_NUMBER"
  printf 'versionName=0.2.%s\n' "$GITHUB_RUN_NUMBER"
  printf 'signingCertificateSHA256=%s\n' "$cert_digest"
} > "$outdir/signing-info.txt"
echo "Stable signed APK validated: package, versionCode=$GITHUB_RUN_NUMBER, certificate=$cert_digest"
