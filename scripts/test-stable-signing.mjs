#!/usr/bin/env node
/** A fixed, intentionally PUBLIC testing key must be the only APK signing identity. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const gradle=await readFile('app/build.gradle','utf8');
const workflow=await readFile('.github/workflows/build-apk.yml','utf8');
const verifier=await readFile('scripts/verify-signed-apk.sh','utf8');
const base64=(await readFile('app/signing/sudokuvania-debug.p12.base64','utf8')).trim();
const cert=(await readFile('app/signing/certificate.sha256','utf8')).trim();
const key=Buffer.from(base64,'base64');
const sha=createHash('sha256').update(key).digest('hex');

assert.match(base64,/^[A-Za-z0-9+/]+={0,2}$/,'Public test key must be valid Base64');
assert.equal(key.toString('base64'),base64,'Public test key Base64 is not canonical');
assert.ok(key.length>2000,'Public test key is suspiciously short');
assert.equal(sha,'a53b760e2e0759e1e6792aa923410349229ef4368b4effbdc0036fca01860d9a',
  'The public key changed and would break upgrade compatibility');
assert.equal(cert,'0762f2cb5e4ff66d1ea2784ef50d7af30640bc66c50f469aedeadfc2c66bf746');
assert.match(gradle,/applicationId 'com\.fanfront\.sodokupadandroid'/);
assert.match(gradle,/System\.getenv\('GITHUB_RUN_NUMBER'\)/);
assert.match(gradle,/versionCode buildNumber/);
assert.match(gradle,/file\('signing\/sudokuvania-debug\.p12\.base64'\)/);
assert.match(gradle,/storeType 'pkcs12'/);
assert.match(gradle,/keyAlias 'sudokuvania'/);
assert.match(gradle,/signingConfig signingConfigs\.stableTest/g);
assert.doesNotMatch(gradle,/SUDOKUVANIA_KEYSTORE_PATH|SUDOKUVANIA_SIGNING_PASSWORD/,
  'A secret must never be needed for the public test key');
assert.doesNotMatch(workflow,/secrets\.SUDOKUVANIA_|vars\.SUDOKUVANIA_/,
  'CI must not need any GitHub secrets or variables');
assert.doesNotMatch(workflow,/scripts\/prepare-signing\.sh/,
  'Remove old secret-backed key preparation from CI');
assert.equal((workflow.match(/run: bash scripts\/verify-signed-apk\.sh/g)||[]).length,2,
  'Both APK workflows must verify the fixed signing certificate');
assert.equal((workflow.match(/name: Sudokuvania-stable-signed-[a-z-]+/g)||[]).length,2,
  'Keep the stable APK artifact names');
assert.match(verifier,/app\/signing\/certificate\.sha256/);
assert.match(verifier,/apksigner/);
assert.match(verifier,/versionCode=/);
console.log('PASS: public fixed key, checked fingerprint, increasing versionCode and zero secrets.');
