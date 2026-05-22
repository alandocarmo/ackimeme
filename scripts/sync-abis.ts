#!/usr/bin/env node
/**
 * sync-abis.js — Audit #27: Unify ABI/TVC files across the project
 *
 * Copies compiled contract artifacts from contracts/ to:
 *   - backend/src/abi/
 *   - frontend/lib/
 *
 * Run after every contract compilation:
 *   node scripts/sync-abis.js
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "contracts");
const TARGETS = [
  path.join(ROOT, "backend", "src", "abi"),
  path.join(ROOT, "frontend", "lib"),
];

const FILES_TO_SYNC = [
  "BondingCurve.abi.json",
  "BondingCurve.tvc",
  "TokenRoot.abi.json",
  "TokenRoot.tvc",
  "TokenWallet.abi.json",
  "TokenWallet.tvc",
  "UpdateCustodianMultisigWallet.abi.json",
  "UpdateCustodianMultisigWallet.tvc",
];

let copied = 0;
let skipped = 0;

for (const file of FILES_TO_SYNC) {
  const src = path.join(SOURCE, file);

  if (!fs.existsSync(src)) {
    console.warn(`⚠️  Source missing: ${file}`);
    skipped++;
    continue;
  }

  const srcContent = fs.readFileSync(src);

  for (const target of TARGETS) {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const dst = path.join(target, file);
    const dstExists = fs.existsSync(dst);

    if (dstExists && Buffer.compare(fs.readFileSync(dst), srcContent) === 0) {
      continue; // Already in sync
    }

    fs.writeFileSync(dst, srcContent);
    console.log(`✅ ${file} → ${path.relative(ROOT, dst)}${dstExists ? " (updated)" : " (created)"}`);
    copied++;
  }
}

console.log(`\nDone: ${copied} files copied, ${skipped} sources missing.`);
