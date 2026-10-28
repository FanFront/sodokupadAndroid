#!/usr/bin/env node
/** Catch regressions that would accidentally restore ephemeral APK signatures. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const gradle=await readFile('app/build.gradle','utf8');
const workflow=await readFile('.github/workflows/build-apk.yml','utf8');
const ignore=await readFile('.gitignore','utf8');
const prepare=await readFile('scripts/prepare-signing.sh','utf8');
const verify=await readFile('scripts/verify-signed-apk.sh','utf8');

assert.match(gradle, /applicationId 'com\.fanfront\.sodokupadandroid'/);
assert.match(gradle, /System\.getenv\('GITHUB_RUN_NUMBER'\)/);
assert.match(gradle, /versionCode buildNumber/);
assert.match(gradle, /if \(System\.getenv\('CI'\) == 'true' && !hasStableSigning\)/);
assert.match(gradle, /storeType 'pkcs12'/);
assert.match(gradle, /keyAlias 'sudokuvania'/);
assert.match(gradle, /signingConfig signingConfigs\.stableTest/);

assert.equal((workflow.match(/run: bash scripts\/prepare-signing\.sh/g)||[]).length,2,
  'Both build pipelines must restore a permanent signing key');
assert.equal((workflow.match(/run: bash scripts\/verify-signed-apk\.sh/g)||[]).length,2,
  'Both build pipelines must verify their APK signatures');
assert.equal((workflow.match(/name: Sudokuvania-stable-signed-[a-z-]+/g)||[]).length,2,
  'Stable-signed artifacts must be distinct from legacy ephemeral debug APKs');
assert.ok(workflow.includes('secrets.SUDOKUVANIA_KEYSTORE_B64'));
assert.ok(workflow.includes('secrets.SUDOKUVANIA_SIGNING_PASSWORD'));
assert.ok(workflow.includes('vars.SUDOKUVANIA_SIGNING_CERT_SHA256'));
assert.match(prepare, /keytool -list/);
assert.match(verify, /apksigner/);
assert.match(verify, /versionCode=/);
assert.match(verify, /signing-info\.txt/);
assert.match(ignore, /^\.signing\/$/m);
assert.match(ignore, /^\*\.p12$/m);
console.log('PASS: both Android APK pipelines require stable signing and increasing versionCode.');
